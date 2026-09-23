//! Runtime manager for TheOpenPresenter.
//!
//! Downloads, verifies, activates, launches and rolls back the Node runtime
//! that the desktop shell runs against. Built as a standalone binary so it can
//! be driven identically from Electron and Tauri, and so it has no dependency
//! on the Node it is responsible for installing.

use std::io::{BufRead, IsTerminal, Write};
use std::time::Duration;

use anyhow::{bail, Context, Result};
use top_runtime_manager::{
    runtime::fetch,
    shell::{
        cli,
        manager::{paths_json, Manager, DEFAULT_SOURCE},
        output::{finish_human_progress, HUMAN_PROGRESS},
        protocol::{Command, Request, Response},
    },
    storage::paths::Layout,
};

/// Ask a yes/no question on the terminal.
///
/// Defaults to no. A non-terminal stdin answers no rather than blocking
/// forever: a script that meant to delete something should pass --force.
fn confirm(question: &str) -> Result<bool> {
    if !std::io::stdin().is_terminal() {
        bail!("{question}\nRefusing without a terminal to ask. Pass --force.");
    }
    eprint!("{question} [y/N] ");
    std::io::stderr().flush()?;

    let mut answer = String::new();
    std::io::stdin().read_line(&mut answer)?;
    Ok(matches!(
        answer.trim().to_ascii_lowercase().as_str(),
        "y" | "yes"
    ))
}

/// Ask to be told when the user interrupts the process.
static INTERRUPTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg(unix)]
fn install_interrupt_handler() {
    extern "C" fn handle(_: libc::c_int) {
        INTERRUPTED.store(true, std::sync::atomic::Ordering::SeqCst);
    }
    unsafe {
        libc::signal(libc::SIGINT, handle as *const () as libc::sighandler_t);
        libc::signal(libc::SIGTERM, handle as *const () as libc::sighandler_t);
    }
}

#[cfg(windows)]
fn install_interrupt_handler() {
    // Windows terminates on Ctrl-C by default. Stopping cleanly needs a
    // console control handler, which is not wired up yet: the runtime's
    // own shutdown path still runs, so PostgreSQL is not left corrupt,
    // but the "Stopping…" message will not appear.
}

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_env("TOP_RUNTIME_LOG")
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let parsed = cli::parse(std::env::args().skip(1), std::io::stdin().is_terminal());

    match parsed.cli {
        cli::Cli::Help => {
            print!("{}", cli::USAGE);
            Ok(())
        }
        cli::Cli::Version => {
            println!("top-runtime-manager {}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        other => run(other, parsed.options),
    }
}

/// Build a manager for the subcommands that need one.
fn open(options: &cli::Options) -> Result<(Manager, String)> {
    let layout = match &options.root {
        Some(root) => Layout::new(root.clone()),
        None => Layout::discover()?,
    };

    // Seed a fresh install from the Tauri app's data, so someone moving
    // across keeps their projects. A no-op unless this is a first run at
    // the default location.
    match layout.adopt_tauri_data() {
        Ok(Some(previous)) => {
            tracing::info!("Copied existing data from {}", previous.display());
        }
        Ok(None) => {}
        Err(e) => tracing::warn!("Could not copy the existing data: {e:#}"),
    }

    let source_arg = options
        .source
        .clone()
        .or_else(|| std::env::var("TOP_RUNTIME_SOURCE").ok())
        .unwrap_or_else(|| DEFAULT_SOURCE.to_string());

    let manager = Manager::new(layout, fetch::source_from_arg(&source_arg))?;
    Ok((manager, source_arg))
}

fn run(command: cli::Cli, options: cli::Options) -> Result<()> {
    // Everything except `serve` is someone at a prompt. JSON output is the
    // exception there, not the default.
    if !matches!(command, cli::Cli::Serve) && !options.json {
        HUMAN_PROGRESS.store(true, std::sync::atomic::Ordering::Relaxed);
    }

    let (mut manager, source_arg) = open(&options)?;

    match command {
        cli::Cli::Serve => {
            tracing::info!(
                "Runtime manager ready (root: {}, source: {source_arg})",
                manager.layout.root().display()
            );
            serve(manager)
        }

        cli::Cli::Paths => {
            let layout = &manager.layout;
            if options.json {
                println!("{}", serde_json::to_string_pretty(&paths_json(layout))?);
            } else {
                println!("root      {}", layout.root().display());
                println!("versions  {}", layout.runtimes_dir().display());
                println!(
                    "data      {}  (your work; back this up)",
                    layout.state_dir().display()
                );
                println!(
                    "cache     {}  (safe to delete)",
                    layout.cache_dir().display()
                );
                println!("logs      {}", layout.logs_dir().display());
            }
            Ok(())
        }

        cli::Cli::Status => {
            let status = manager.status()?;
            if options.json {
                println!("{}", serde_json::to_string_pretty(&status)?);
                return Ok(());
            }

            let installed = status["installed"].as_array().cloned().unwrap_or_default();
            match status["current"].as_str() {
                Some(version) => println!("Active:    {version}"),
                None => println!("Active:    none installed"),
            }
            if installed.is_empty() {
                println!("Installed: none");
            } else {
                let names: Vec<String> = installed
                    .iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect();
                println!("Installed: {}", names.join(", "));
            }
            // Deliberately not printed: `running` is per-process state, and
            // a fresh `status` invocation supervises nothing, so it would
            // always say "no" even while a server is serving. Reporting a
            // value that is always wrong is worse than omitting it.
            Ok(())
        }

        cli::Cli::Check { channel } => {
            // Route through the same handler the protocol uses, so the CLI
            // can never drift from what the shell sees.
            let result = manager.handle(Request {
                id: None,
                command: Command::Check {
                    channel: channel.clone(),
                },
            })?;
            if options.json {
                println!("{}", serde_json::to_string_pretty(&result)?);
            } else {
                match result["version"].as_str() {
                    Some(version) => println!("{channel}: {version}"),
                    None => println!("{channel}: no release found"),
                }
            }
            Ok(())
        }

        cli::Cli::Install {
            channel,
            version,
            activate,
        } => {
            let result = manager.handle(Request {
                id: None,
                command: Command::Ensure {
                    channel,
                    version,
                    activate,
                },
            })?;
            finish_human_progress();
            if options.json {
                println!("{}", serde_json::to_string_pretty(&result)?);
            } else {
                let version = result["version"].as_str().unwrap_or("?");
                if activate {
                    println!("Installed and activated {version}");
                } else {
                    println!("Downloaded {version}");
                    println!("Run `activate {version}` to switch to it.");
                }
            }
            Ok(())
        }

        cli::Cli::Activate { version } => {
            // Default to the newest installed version: the common case is
            // "activate what I just downloaded", and making the user retype
            // the version they were told a moment ago is friction for
            // nothing.
            let version = match version {
                Some(v) => v,
                None => manager
                    .layout
                    .installed_versions()
                    .pop()
                    .context("Nothing is installed to activate")?,
            };

            manager.handle(Request {
                id: None,
                command: Command::Activate {
                    version: version.clone(),
                },
            })?;
            finish_human_progress();
            println!("Activated {version}");
            println!("The change takes effect when the server next starts.");
            Ok(())
        }

        cli::Cli::Start => {
            // Install first if nothing is active, so the standalone path
            // is one command on a clean machine rather than three.
            if manager.state().ok().and_then(|s| s.current).is_none() {
                println!("No runtime installed yet. Downloading one.");
                manager.handle(Request {
                    id: None,
                    command: Command::Ensure {
                        channel: Some("stable".to_string()),
                        version: None,
                        activate: true,
                    },
                })?;
                finish_human_progress();
            }

            let result = manager.handle(Request {
                id: None,
                command: Command::Start,
            })?;
            finish_human_progress();

            let url = result["url"].as_str().unwrap_or("");
            println!("\nTheOpenPresenter is running at {url}");
            println!("Press Ctrl-C to stop.\n");

            // Stop the server on Ctrl-C rather than leaving PostgreSQL
            // holding its port and its data directory locked.
            install_interrupt_handler();

            while !INTERRUPTED.load(std::sync::atomic::Ordering::SeqCst) {
                // pump marks the runtime good once it settles and reaps
                // it if it dies, which is what makes the crash counter
                // work in the standalone path too.
                manager.pump();
                if manager.supervisor.is_none() {
                    println!("The server stopped.");
                    return Ok(());
                }
                std::thread::sleep(Duration::from_millis(200));
            }

            println!("Stopping…");
            manager.handle(Request {
                id: None,
                command: Command::Stop,
            })?;
            println!("Stopped.");
            Ok(())
        }

        cli::Cli::Remove { version, force } => {
            // Default to the active version: "remove" with no argument
            // most often means "this one is broken, get rid of it".
            let state = manager.state().ok();
            let version = match version {
                Some(v) => v,
                None => state
                    .as_ref()
                    .and_then(|s| s.current.clone())
                    .or_else(|| manager.layout.installed_versions().pop())
                    .context("Nothing is installed to remove")?,
            };

            let is_active = state.and_then(|s| s.current) == Some(version.clone());

            if !force && !options.json {
                // Only the active version warrants a prompt: removing an
                // inactive one is cheap and reversible by re-downloading.
                if is_active
                    && !confirm(&format!(
                        "{version} is the version in use. Remove it? \
                         Your presentations and database are not affected."
                    ))?
                {
                    println!("Left alone.");
                    return Ok(());
                }
            }

            let result = manager.handle(Request {
                id: None,
                command: Command::Remove {
                    version: version.clone(),
                },
            })?;
            finish_human_progress();

            if options.json {
                println!("{}", serde_json::to_string_pretty(&result)?);
                return Ok(());
            }

            println!("Removed {version}");
            match result["active"].as_str() {
                Some(next) if result["wasActive"].as_bool() == Some(true) => {
                    println!("Now using {next}.");
                }
                None if result["wasActive"].as_bool() == Some(true) => {
                    println!("No runtime is installed now. Run `install` to get one.");
                }
                _ => {}
            }
            println!("Run `prune` to reclaim the disk space it used.");
            Ok(())
        }

        cli::Cli::Prune => {
            // Keep only what is active: this is the command a user reaches
            // for when the disk is full, so it should actually free space.
            let keep: Vec<String> = manager
                .state()
                .ok()
                .and_then(|s| s.current)
                .into_iter()
                .collect();
            let freed = manager.handle(Request {
                id: None,
                command: Command::Prune { keep },
            })?;
            let bytes = freed["freedBytes"].as_u64().unwrap_or(0);
            println!("Reclaimed {:.1} MB", bytes as f64 / 1_048_576.0);
            Ok(())
        }

        cli::Cli::Help | cli::Cli::Version => unreachable!("handled in main"),
    }
}

/// The long-lived NDJSON loop the desktop shell drives.
fn serve(mut manager: Manager) -> Result<()> {
    let stdin = std::io::stdin();
    for line in stdin.lock().lines() {
        let line = line?;
        manager.pump();

        let Some(parsed) = top_runtime_manager::shell::protocol::parse_line(&line) else {
            continue;
        };

        let request = match parsed {
            Ok(request) => request,
            Err(e) => {
                println!(
                    "{}",
                    top_runtime_manager::shell::protocol::encode(&Response::err(None, e))
                );
                continue;
            }
        };

        let id = request.id;
        let shutdown = matches!(request.command, Command::Shutdown);

        let response = match manager.handle(request) {
            Ok(result) => Response::ok(id, result),
            Err(e) => Response::err(id, format!("{e:#}")),
        };
        println!(
            "{}",
            top_runtime_manager::shell::protocol::encode(&response)
        );
        std::io::stdout().flush()?;

        if shutdown {
            return Ok(());
        }
    }

    // stdin closed: the shell is gone, so the runtime should not outlive it.
    if let Some(supervisor) = manager.supervisor.take() {
        supervisor.stop().ok();
    }
    Ok(())
}
