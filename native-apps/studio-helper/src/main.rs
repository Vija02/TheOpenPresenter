//! Native helper for TheOpenPresenter Studio.

use std::io::{BufRead, IsTerminal, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use top_runtime_manager::Layout;
use top_studio_helper::{
    cli,
    protocol::{encode, parse_line, Command, Response},
    remote::Event,
    service::Helper,
};

static INTERRUPTED: AtomicBool = AtomicBool::new(false);

#[cfg(unix)]
fn install_interrupt_handler() {
    extern "C" fn handle(_: libc::c_int) {
        INTERRUPTED.store(true, Ordering::SeqCst);
    }
    unsafe {
        libc::signal(libc::SIGINT, handle as *const () as libc::sighandler_t);
        libc::signal(libc::SIGTERM, handle as *const () as libc::sighandler_t);
    }
}

#[cfg(windows)]
fn install_interrupt_handler() {
    // Windows terminates on Ctrl-C by default. The lock entry is dropped by
    // the next reader once our pid is gone, so nothing is left advertised.
}

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_ansi(std::io::stderr().is_terminal())
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_env("TOP_STUDIO_HELPER_LOG")
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let parsed = cli::parse(std::env::args().skip(1), std::io::stdin().is_terminal());

    let options = parsed.options;
    let layout = || match options.root.clone() {
        Some(root) => Ok(Layout::new(root)),
        None => Layout::discover(),
    };

    match parsed.cli {
        cli::Cli::Help => {
            print!("{}", cli::USAGE);
            Ok(())
        }
        cli::Cli::Version => {
            println!("top-studio-helper {}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        // No layout needed, and must stay instant: the app waits on it.
        cli::Cli::GrabInput => top_studio_helper::input::grab_input(),
        cli::Cli::Serve => {
            // One line per event, written under the stdout lock so it can't
            // interleave with a response. Errors are ignored: `println!`
            // would panic once the shell has closed stdout.
            let events = Arc::new(|event: Event| {
                let _ = writeln!(std::io::stdout().lock(), "{}", encode(&event));
            });
            serve(Helper::with_events(layout()?, events))
        }
        cli::Cli::RemoteDiscover => remote_discover(layout()?),
        cli::Cli::RemoteStart => remote_start(Helper::new(layout()?), options),
        cli::Cli::RemoteStatus => remote_status(Helper::new(layout()?), options),
        cli::Cli::RemoteConnect(peer) => remote_connect(Helper::new(layout()?), peer, options),
    }
}

fn remote_status(mut helper: Helper, options: cli::Options) -> Result<()> {
    let result = helper.handle(Command::RemoteStatus)?;
    if options.json {
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else if result["enabled"] == true {
        println!("Remote access is on.");
        println!("\nTicket:\n{}", result["ticket"].as_str().unwrap_or(""));
    } else {
        println!("Remote access is off.");
    }
    Ok(())
}

fn remote_start(mut helper: Helper, options: cli::Options) -> Result<()> {
    let result = helper.handle(Command::RemoteStart {
        port: options.port,
        name: None,
    })?;
    if options.json {
        println!("{}", serde_json::to_string(&result)?);
    } else {
        println!("Remote access is on. Share this ticket:\n");
        println!("{}", result["ticket"].as_str().unwrap_or(""));
        println!("\nPress Ctrl-C to stop.\n");
    }

    install_interrupt_handler();
    while !INTERRUPTED.load(Ordering::SeqCst) {
        helper.pump();
        std::thread::sleep(Duration::from_millis(200));
    }

    println!("Stopping…");
    helper.shutdown();
    Ok(())
}

fn remote_discover(layout: Layout) -> Result<()> {
    let events = Arc::new(|event: Event| match event {
        Event::HostDiscovered { host } => {
            let port = host.port.map(|p| format!(", port {p}")).unwrap_or_default();
            println!("+ {}{port}\n  {}", host.name, host.id);
        }
        Event::HostExpired { id } => println!("- {id}"),
    });
    let mut helper = Helper::with_events(layout, events);
    helper.handle(Command::DiscoverStart)?;
    println!("Looking for Studios on this network. Press Ctrl-C to stop.\n");

    install_interrupt_handler();
    while !INTERRUPTED.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(200));
    }
    helper.shutdown();
    Ok(())
}

fn remote_connect(mut helper: Helper, peer: String, options: cli::Options) -> Result<()> {
    let result = helper.handle(Command::RemoteConnect {
        peer,
        port: options.port,
    })?;
    if options.json {
        println!("{}", serde_json::to_string(&result)?);
    } else {
        println!("Connected. Open this in a browser:\n");
        println!("{}", result["local_url"].as_str().unwrap_or(""));
        println!("\nPress Ctrl-C to disconnect.\n");
    }

    install_interrupt_handler();
    while !INTERRUPTED.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(200));
    }

    println!("Disconnecting…");
    helper.shutdown();
    Ok(())
}

fn serve(mut helper: Helper) -> Result<()> {
    tracing::info!("Helper ready (root: {})", helper.layout.root().display());

    // On its own thread so the loop can `pump` between commands.
    let (lines_tx, lines) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        for line in std::io::stdin().lock().lines() {
            if lines_tx.send(line).is_err() {
                break;
            }
        }
    });

    loop {
        let line = match lines.recv_timeout(Duration::from_millis(500)) {
            Ok(Ok(line)) => line,
            // Skip, rather than exit without cleaning up.
            Ok(Err(e)) if e.kind() == std::io::ErrorKind::InvalidData => {
                tracing::warn!("Ignoring a line that isn't UTF-8");
                continue;
            }
            Ok(Err(e)) => {
                tracing::warn!("Reading stdin failed: {e}");
                break;
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                helper.pump();
                continue;
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        };
        helper.pump();

        let Some(parsed) = parse_line(&line) else {
            continue;
        };
        let request = match parsed {
            Ok(request) => request,
            Err(e) => {
                println!("{}", encode(&Response::err(None, e)));
                std::io::stdout().flush()?;
                continue;
            }
        };

        let id = request.id;
        let shutdown = matches!(request.command, Command::Shutdown);
        let response = match helper.handle(request.command) {
            Ok(result) => Response::ok(id, result),
            Err(e) => Response::err(id, format!("{e:#}")),
        };
        println!("{}", encode(&response));
        std::io::stdout().flush()?;

        if shutdown {
            return Ok(());
        }
    }

    // The shell is gone; don't leave a tunnel nobody controls.
    helper.shutdown();
    Ok(())
}
