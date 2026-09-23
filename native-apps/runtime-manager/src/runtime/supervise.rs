//! Launching and supervising the runtime process.
//!
//! The manager owns launching, not just installing. That keeps version and
//! path knowledge in one place, makes install-then-run atomic, and is what
//! allows the crash counter to auto-revert instead of leaving the user with
//! an app that will not start.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::{bail, Context, Result};

use crate::storage::paths::Layout;

/// What the supervised process told us, or what happened to it.
#[derive(Debug, Clone)]
pub enum RuntimeEvent {
    Stdout(String),
    Stderr(String),
    Listening { url: String, port: u16 },
    Exited { code: Option<i32> },
}

/// Ask the OS for a free port by binding to :0 and reading back what we got.
pub fn free_port() -> Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0").context("Failed to allocate a local port")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

pub struct LaunchConfig {
    pub runtime_dir: PathBuf,
    pub entry: String,
    pub http_port: u16,
    pub pg_port: u16,
    pub layout: Layout,
    /// Extra environment for the runtime, e.g. plugin credentials.
    pub extra_env: Vec<(String, String)>,
    /// Plugins the server loads. Comes from the manifest, so a runtime
    /// carries its own list rather than the manager guessing.
    pub plugins: Vec<String>,
}

impl LaunchConfig {
    /// Resolve the bundled `node`, falling back to whatever is on PATH. A
    /// local development runtime does not necessarily ship one.
    pub fn node_binary(&self) -> PathBuf {
        let name = if cfg!(windows) { "node.exe" } else { "node" };
        for candidate in [
            self.runtime_dir.join(name),
            self.runtime_dir.join("bin").join(name),
        ] {
            if candidate.is_file() {
                return candidate;
            }
        }
        PathBuf::from("node")
    }

    fn env(&self) -> Vec<(String, String)> {
        let layout = &self.layout;
        let mut env: Vec<(String, String)> = vec![
            ("TOP_HTTP_PORT".into(), self.http_port.to_string()),
            ("PORT".into(), self.http_port.to_string()),
            ("TOP_PG_PORT".into(), self.pg_port.to_string()),
            (
                "ROOT_URL".into(),
                format!("http://localhost:{}", self.http_port),
            ),
            (
                "TOP_STATE_DIR".into(),
                layout.state_dir().to_string_lossy().into_owned(),
            ),
            (
                "TOP_PGDATA_DIR".into(),
                layout.pgdata_dir().to_string_lossy().into_owned(),
            ),
            (
                "UPLOADS_PATH".into(),
                layout.uploads_dir().to_string_lossy().into_owned(),
            ),
            (
                "TOP_ENV_FILE".into(),
                layout.env_file().to_string_lossy().into_owned(),
            ),
        ];

        // The full server environment, composed here rather than inside
        // the runtime, so the manager knows how the server is configured
        // and a headless start needs nothing but this binary.
        let overrides = std::fs::read_to_string(layout.env_file())
            .map(|text| crate::runtime::server_env::parse_env_file(&text))
            .unwrap_or_default();

        let composed = crate::runtime::server_env::ServerEnv {
            http_port: self.http_port,
            pg_port: self.pg_port,
            uploads_path: &layout.uploads_dir(),
            plugins: &self.plugins,
            overrides,
        }
        .compose();
        env.extend(composed);

        env.extend(self.extra_env.iter().cloned());
        env
    }
}

pub struct Supervisor {
    child: Arc<Mutex<Option<Child>>>,
    events: Option<Receiver<RuntimeEvent>>,
    started_at: Instant,
}

/// How long the runtime gets to shut PostgreSQL down before it is killed.
pub const SHUTDOWN_GRACE: Duration = Duration::from_secs(20);

impl Supervisor {
    pub fn spawn(config: &LaunchConfig) -> Result<Self> {
        let entry = config.runtime_dir.join(&config.entry);
        if !entry.is_file() {
            bail!("Runtime entrypoint not found: {}", entry.display());
        }

        let node = config.node_binary();
        let mut command = Command::new(&node);
        command
            .arg(&entry)
            .current_dir(&config.runtime_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        for (key, value) in config.env() {
            command.env(key, value);
        }

        let mut child = command
            .spawn()
            .with_context(|| format!("Failed to start {}", node.display()))?;

        let (tx, rx) = mpsc::channel();

        // Tee every line to a log file as well as the event stream.
        //
        // Without this the only record of why a server failed to start is
        // whatever the shell happened to keep in memory, which is gone by
        // the time anyone asks. A file the user can be pointed at is the
        // difference between "it didn't work" and a diagnosis.
        let log = Arc::new(Mutex::new(open_log(&config.layout)));

        let stdout = child.stdout.take().context("No stdout on the runtime")?;
        let tx_out = tx.clone();
        let log_out = Arc::clone(&log);
        std::thread::spawn(move || {
            // The runtime announces its port twice: once in the structured
            // line meant for us, and once in the server's own banner. Both
            // are worth recognising, but a consumer that navigates on this
            // event should not be told twice.
            let mut announced = false;
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                write_log(&log_out, &line);
                if !announced {
                    if let Some(event) = parse_listening(&line) {
                        announced = true;
                        let _ = tx_out.send(event);
                    }
                }
                let _ = tx_out.send(RuntimeEvent::Stdout(line));
            }
        });

        let stderr = child.stderr.take().context("No stderr on the runtime")?;
        let tx_err = tx.clone();
        let log_err = Arc::clone(&log);
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                write_log(&log_err, &line);
                let _ = tx_err.send(RuntimeEvent::Stderr(line));
            }
        });

        Ok(Self {
            child: Arc::new(Mutex::new(Some(child))),
            events: Some(rx),
            started_at: Instant::now(),
        })
    }

    /// Hand the event stream to a caller that will drain it continuously.
    ///
    /// Events must be pumped by a dedicated thread rather than between
    /// commands: a runtime announces its port seconds after `start` returns,
    /// and if nothing is reading at that moment the shell never learns the
    /// URL until the user happens to trigger another command.
    pub fn take_events(&mut self) -> Option<Receiver<RuntimeEvent>> {
        self.events.take()
    }

    pub fn uptime(&self) -> Duration {
        self.started_at.elapsed()
    }

    /// Non-blocking check. Returns the exit code once the process is gone.
    pub fn poll_exit(&self) -> Option<Option<i32>> {
        let mut guard = self.child.lock().ok()?;
        let child = guard.as_mut()?;
        match child.try_wait() {
            Ok(Some(status)) => {
                *guard = None;
                Some(status.code())
            }
            _ => None,
        }
    }

    /// Whether the process has already gone, without consuming its exit
    /// code.
    ///
    /// `poll_exit` clears the child handle, which the crash reaper needs,
    /// so a readiness check must not use it.
    pub fn exited(&self) -> bool {
        let Ok(mut guard) = self.child.lock() else {
            return false;
        };
        match guard.as_mut() {
            Some(child) => matches!(child.try_wait(), Ok(Some(_))),
            None => true,
        }
    }

    /// Ask the runtime to stop over stdin rather than by signal: it behaves
    /// identically on Windows, which has no SIGTERM, and killing outright
    /// leaves PostgreSQL running and holding its port, which breaks the
    /// *next* launch.
    pub fn stop(&self) -> Result<()> {
        use std::io::Write;

        {
            let mut guard = self.child.lock().unwrap();
            let Some(child) = guard.as_mut() else {
                return Ok(());
            };
            if let Some(stdin) = child.stdin.as_mut() {
                let _ = stdin.write_all(b"shutdown\n");
                let _ = stdin.flush();
            }
        }

        let deadline = Instant::now() + SHUTDOWN_GRACE;
        while Instant::now() < deadline {
            if self.poll_exit().is_some() {
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(100));
        }

        tracing::warn!(
            "Runtime did not exit within {SHUTDOWN_GRACE:?}; killing it. PostgreSQL may be \
             left holding its port."
        );
        self.kill()
    }

    pub fn kill(&self) -> Result<()> {
        let mut guard = self.child.lock().unwrap();
        if let Some(mut child) = guard.take() {
            child.kill().ok();
            child.wait().ok();
        }
        Ok(())
    }
}

/// Recognise the runtime announcing its port.
///
/// Two shapes are accepted: the structured line the runtime prints for us,
/// and the human-readable banner the server has always printed. The second
/// means a runtime built before this protocol existed still works.
fn parse_listening(line: &str) -> Option<RuntimeEvent> {
    if let Some(rest) = line.trim().strip_prefix("TOP_LISTENING ") {
        let port: u16 = rest.trim().parse().ok()?;
        return Some(RuntimeEvent::Listening {
            url: format!("http://localhost:{port}"),
            port,
        });
    }

    let marker = "listening on port ";
    let idx = line.to_lowercase().find(marker)?;
    let tail = &line[idx + marker.len()..];
    let digits: String = tail.chars().take_while(char::is_ascii_digit).collect();
    let port: u16 = digits.parse().ok()?;
    Some(RuntimeEvent::Listening {
        url: format!("http://localhost:{port}"),
        port,
    })
}

/// Open the runtime log, truncating the previous run's.
///
/// One file rather than a rotating set: what anyone ever wants is "why did
/// it fail just now", and a directory of timestamped files is a disk leak
/// plus a question about which one to read. The previous run is kept as
/// `.1` because a crash-restart loop would otherwise erase the evidence.
fn open_log(layout: &Layout) -> Option<std::fs::File> {
    let dir = layout.logs_dir();
    if std::fs::create_dir_all(&dir).is_err() {
        return None;
    }
    let current = dir.join("runtime.log");
    std::fs::rename(&current, dir.join("runtime.1.log")).ok();

    match std::fs::File::create(&current) {
        Ok(file) => Some(file),
        Err(e) => {
            // Logging is diagnostics, not function: never fail a start
            // because the log could not be opened.
            tracing::warn!("Could not open {}: {e}", current.display());
            None
        }
    }
}

fn write_log(log: &Arc<Mutex<Option<std::fs::File>>>, line: &str) {
    let Ok(mut guard) = log.lock() else { return };
    let Some(file) = guard.as_mut() else { return };
    let _ = writeln!(file, "{line}");
}

/// Best-effort readiness probe against the runtime's HTTP port.
pub fn wait_for_http(port: u16, timeout: Duration) -> bool {
    use std::net::TcpStream;

    let deadline = Instant::now() + timeout;
    let addr = format!("127.0.0.1:{port}");
    while Instant::now() < deadline {
        if TcpStream::connect(&addr).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    false
}

/// Write a launch script for manual debugging. Reproducing the exact
/// environment by hand is otherwise painful enough that people guess.
pub fn write_debug_launcher(config: &LaunchConfig, dest: &Path) -> Result<()> {
    let mut script = String::from("#!/bin/sh\n# Generated by top-runtime-manager\n");
    for (key, value) in config.env() {
        script.push_str(&format!("export {key}=\"{value}\"\n"));
    }
    script.push_str(&format!(
        "cd \"{}\"\nexec \"{}\" \"{}\"\n",
        config.runtime_dir.display(),
        config.node_binary().display(),
        config.entry
    ));
    std::fs::write(dest, script)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(dir: &Path, entry: &str) -> LaunchConfig {
        LaunchConfig {
            runtime_dir: dir.to_path_buf(),
            entry: entry.to_string(),
            http_port: 12345,
            pg_port: 12346,
            layout: Layout::new(dir.join("data")),
            extra_env: vec![],
            plugins: vec![],
        }
    }

    #[test]
    fn allocated_ports_are_distinct_and_usable() {
        let a = free_port().unwrap();
        let b = free_port().unwrap();
        assert_ne!(a, 0);
        assert_ne!(a, b);
        // The port must genuinely be free right after allocation.
        TcpListener::bind(("127.0.0.1", a)).unwrap();
    }

    #[test]
    fn the_structured_listening_line_is_recognised() {
        let event = parse_listening("TOP_LISTENING 53411").unwrap();
        match event {
            RuntimeEvent::Listening { url, port } => {
                assert_eq!(port, 53411);
                assert_eq!(url, "http://localhost:53411");
            }
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[test]
    fn the_legacy_banner_is_still_recognised() {
        let event = parse_listening("  TheOpenPresenter listening on port 5678").unwrap();
        match event {
            RuntimeEvent::Listening { port, .. } => assert_eq!(port, 5678),
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[test]
    fn ordinary_log_lines_are_not_mistaken_for_a_port() {
        assert!(parse_listening("Starting worker...").is_none());
        assert!(parse_listening("listening on port banana").is_none());
    }

    #[test]
    fn the_environment_points_state_outside_the_runtime() {
        let tmp = tempfile::tempdir().unwrap();
        let config = config(tmp.path(), "run_server.mjs");
        let env: std::collections::HashMap<_, _> = config.env().into_iter().collect();

        let pgdata = PathBuf::from(&env["TOP_PGDATA_DIR"]);
        assert!(
            !pgdata.starts_with(&config.runtime_dir) || pgdata.starts_with(tmp.path().join("data")),
            "pgdata must live under the state dir, not inside the runtime tree"
        );
        assert_eq!(env["PORT"], "12345");
        assert_eq!(env["TOP_PG_PORT"], "12346");
    }

    #[test]
    fn a_bundled_node_is_preferred_over_path() {
        let tmp = tempfile::tempdir().unwrap();
        let name = if cfg!(windows) { "node.exe" } else { "node" };
        std::fs::write(tmp.path().join(name), b"").unwrap();

        let config = config(tmp.path(), "run_server.mjs");
        assert_eq!(config.node_binary(), tmp.path().join(name));
    }

    #[test]
    fn a_missing_entrypoint_fails_before_spawning() {
        let tmp = tempfile::tempdir().unwrap();
        let err = match Supervisor::spawn(&config(tmp.path(), "nope.mjs")) {
            Ok(_) => panic!("spawning with a missing entrypoint must fail"),
            Err(e) => e.to_string(),
        };
        assert!(err.contains("entrypoint not found"), "{err}");
    }

    #[test]
    fn the_debug_launcher_captures_the_real_environment() {
        let tmp = tempfile::tempdir().unwrap();
        let config = config(tmp.path(), "run_server.mjs");
        let dest = tmp.path().join("launch.sh");

        write_debug_launcher(&config, &dest).unwrap();

        let script = std::fs::read_to_string(&dest).unwrap();
        assert!(script.contains("export PORT=\"12345\""));
        assert!(script.contains("run_server.mjs"));
    }
}
