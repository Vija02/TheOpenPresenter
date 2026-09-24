//! The stateful core: one installed runtime, optionally running.
//!
//! Every command the CLI and the JSON protocol accept lands here, so the
//! two front ends cannot drift apart in behaviour. Nothing in this module
//! prints: callers decide whether a result becomes JSON on stdout or prose
//! on a terminal.

use std::sync::mpsc::Receiver;
use std::time::Duration;

use anyhow::{bail, Context, Result};

use crate::runtime::fetch::Source;
use crate::runtime::install::Installer;
use crate::runtime::manifest::{self, Manifest};
use crate::runtime::state::{CurrentState, SETTLE_SECONDS};
use crate::runtime::supervise::{free_port, wait_for_http, LaunchConfig, RuntimeEvent, Supervisor};
use crate::shell::output::{emit, emit_progress};
use crate::shell::protocol::{Command, Event, Request};
use crate::storage::{disk, paths::Layout};

pub const DEFAULT_SOURCE: &str = "https://runtime.theopenpresenter.com";

pub struct Manager {
    pub layout: Layout,
    source: Box<dyn Source>,
    pubkey: ed25519_dalek::VerifyingKey,
    /// Manifest of the version last ensured, so `start` knows the entrypoint
    /// without re-fetching.
    pending: Option<Manifest>,
    pub supervisor: Option<Supervisor>,
    marked_good: bool,
}

impl Manager {
    pub fn new(layout: Layout, source: Box<dyn Source>) -> Result<Self> {
        layout.ensure()?;
        Ok(Self {
            layout,
            source,
            pubkey: manifest::trusted_pubkey()?,
            pending: None,
            supervisor: None,
            marked_good: false,
        })
    }

    pub fn installer(&self) -> Installer<'_> {
        Installer::new(self.layout.clone(), self.source.as_ref(), self.pubkey)
    }

    pub fn state(&self) -> Result<CurrentState> {
        CurrentState::load(&self.layout.current_file())
    }

    pub fn handle(&mut self, request: Request) -> Result<serde_json::Value> {
        match request.command {
            Command::Status => self.status(),
            Command::Check { channel } => {
                let version = self.installer().resolve_channel(&channel)?;
                Ok(serde_json::json!({ "channel": channel, "version": version }))
            }
            Command::Ensure {
                channel,
                version,
                activate,
            } => self.ensure(channel, version, activate),
            Command::Activate { version } => {
                // The stored manifest, not the network: activating an
                // installed version must work offline.
                let manifest = self.installer().load_manifest(&version)?;
                self.installer().activate(&manifest)?;
                Ok(serde_json::json!({ "version": version }))
            }
            Command::Start => self.start(),
            Command::Stop => {
                if let Some(supervisor) = self.supervisor.take() {
                    supervisor.stop()?;
                }
                Ok(serde_json::json!({ "stopped": true }))
            }
            Command::Remove { version } => {
                // Deleting the files out from under a running server would
                // leave a process serving a directory that no longer
                // exists, and PostgreSQL holding its port.
                let active = self.state().ok().and_then(|s| s.current);
                if self.supervisor.is_some() && active.as_deref() == Some(version.as_str()) {
                    if let Some(supervisor) = self.supervisor.take() {
                        supervisor.stop().ok();
                    }
                }

                let outcome = self.installer().remove(&version)?;
                Ok(serde_json::json!({
                    "removed": version,
                    "wasActive": outcome.was_active,
                    "active": outcome.fell_back_to,
                }))
            }
            Command::Paths => Ok(paths_json(&self.layout)),
            Command::Prune { keep } => {
                let freed = self.installer().prune(&keep)?;
                Ok(serde_json::json!({ "freedBytes": freed }))
            }
            Command::RecordMigration { schema_version } => {
                let path = self.layout.current_file();
                let mut state = CurrentState::load(&path)?;
                state.record_migration(schema_version);
                state.save(&path)?;
                Ok(serde_json::json!({ "migratedSchemaVersion": state.migrated_schema_version }))
            }
            Command::Shutdown => {
                if let Some(supervisor) = self.supervisor.take() {
                    supervisor.stop().ok();
                }
                Ok(serde_json::json!({ "shuttingDown": true }))
            }
        }
    }

    pub fn status(&self) -> Result<serde_json::Value> {
        let state = self.state()?;
        Ok(serde_json::json!({
            "root": self.layout.root().to_string_lossy(),
            "installed": self.layout.installed_versions(),
            "current": state.current,
            "lastGood": state.last_good,
            "migratedSchemaVersion": state.migrated_schema_version,
            "crashCount": state.crash_count,
            "running": self.supervisor.is_some(),
        }))
    }

    /// Download a version and make it present on disk.
    fn ensure(
        &mut self,
        channel: Option<String>,
        version: Option<String>,
        activate: bool,
    ) -> Result<serde_json::Value> {
        let installer = self.installer();
        let version = match (version, channel) {
            (Some(v), _) => v,
            (None, Some(c)) => installer.resolve_channel(&c)?,
            (None, None) => installer.resolve_channel("stable")?,
        };

        let manifest = installer.fetch_manifest(&version)?;

        // Check the disk before writing anything.
        let held = installer.bytes_already_held(&manifest);
        match disk::check(self.layout.root(), manifest.total_size(), held)? {
            disk::Fit::TooSmall { needed, available } => {
                bail!(
                    "Not enough disk space: {} needed, {} available. \
                     Free some space and try again, or run `prune` to remove \
                     unused runtimes.",
                    disk::human(needed),
                    disk::human(available)
                );
            }
            disk::Fit::Tight { free_after } => {
                // Proceed, but say so: this is the machine that will hit a
                // full disk next week.
                emit(&Event::Warning {
                    message: format!(
                        "Low disk space: about {} will be left after installing.",
                        disk::human(free_after)
                    ),
                });
            }
            disk::Fit::Fine => {}
        }

        let root = installer.ensure(&manifest, &mut |progress| emit_progress(progress))?;

        if activate {
            installer.activate(&manifest)?;
        }

        emit(&Event::Ready {
            version: manifest.version.clone(),
            root: root.to_string_lossy().into_owned(),
            entry: manifest.entry.clone(),
        });

        let result = serde_json::json!({
            "version": manifest.version,
            "root": root.to_string_lossy(),
            "entry": manifest.entry,
            "activated": activate,
        });
        self.pending = Some(manifest);
        Ok(result)
    }

    fn start(&mut self) -> Result<serde_json::Value> {
        if self.supervisor.is_some() {
            bail!("A runtime is already running; stop it first");
        }

        let state = self.state()?;
        let version = state
            .current
            .clone()
            .context("No runtime is active. Run `ensure` first.")?;

        // Entry and plugin list both come from the runtime's own
        // manifest, so a release declares what it is rather than the
        // manager carrying assumptions about it.
        let installed = match &self.pending {
            Some(m) if m.version == version => Some(m.clone()),
            // Offline with an installed runtime is the normal case for
            // local mode, so a missing manifest falls back below rather
            // than refusing to start.
            _ => self.installer().load_manifest(&version).ok(),
        };

        let entry = installed
            .as_ref()
            .map(|m| m.entry.clone())
            .unwrap_or_else(|| "run_server.mjs".to_string());
        let plugins = installed
            .as_ref()
            .map(|m| m.plugins.clone())
            .unwrap_or_default();

        let config = LaunchConfig {
            runtime_dir: self.layout.runtime_dir(&version),
            entry,
            http_port: free_port()?,
            pg_port: free_port()?,
            layout: self.layout.clone(),
            extra_env: vec![],
            plugins,
        };

        let mut supervisor = Supervisor::spawn(&config)?;

        // Drain runtime output on its own thread. The runtime announces its
        // port seconds after this call returns, and a manager that only
        // pumped between commands would never forward that event.
        if let Some(events) = supervisor.take_events() {
            std::thread::spawn(move || pump_events(events));
        }

        self.marked_good = false;
        self.supervisor = Some(supervisor);

        // Do not report success until the port actually answers.
        emit(&Event::Progress {
            phase: "starting".to_string(),
            done: 0,
            total: 0,
            bytes: None,
        });

        let deadline = startup_timeout();
        let ready = {
            // Poll the port, but stop early if the process dies
            let start = std::time::Instant::now();
            loop {
                if wait_for_http(config.http_port, Duration::from_millis(500)) {
                    break true;
                }
                if self.supervisor.as_ref().map(|s| s.exited()).unwrap_or(true) {
                    break false;
                }
                if start.elapsed() >= deadline {
                    break false;
                }
            }
        };

        if !ready {
            // A runtime that exited is a different failure from one that is
            // merely slow, and the user can act on the difference.
            let died = self
                .supervisor
                .as_ref()
                .map(|s| s.exited())
                .unwrap_or(false);

            let log = self.layout.logs_dir().join("runtime.log");
            if died {
                bail!(
                    "The server stopped while starting up. Its log is at {}.",
                    log.display()
                );
            }
            bail!(
                "The server did not start listening on port {} within {}s. \
                 Its log is at {}.",
                config.http_port,
                deadline.as_secs(),
                log.display()
            );
        }

        Ok(serde_json::json!({
            "version": version,
            "httpPort": config.http_port,
            "pgPort": config.pg_port,
            "url": format!("http://localhost:{}", config.http_port),
        }))
    }

    /// Notice a runtime that exited and apply the crash policy.
    ///
    /// Output forwarding happens on the pump thread started by `start`; this
    /// only handles state transitions, which can wait until the next command.
    pub fn pump(&mut self) {
        let Some(supervisor) = self.supervisor.as_ref() else {
            return;
        };

        // A runtime that has been up past the settle window counts as good.
        if !self.marked_good
            && supervisor.uptime() > Duration::from_secs(SETTLE_SECONDS)
            && supervisor.poll_exit().is_none()
        {
            self.marked_good = true;
            if let Ok(mut state) = self.state() {
                state.mark_good();
                state.save(&self.layout.current_file()).ok();
            }
        }

        if let Some(code) = supervisor.poll_exit() {
            self.on_exit(code);
        }
    }

    fn on_exit(&mut self, code: Option<i32>) {
        self.supervisor = None;

        let clean = code == Some(0);
        let mut reverted_to = None;

        if !clean && !self.marked_good {
            if let Ok(mut state) = self.state() {
                if let Some(target) = state.record_crash() {
                    tracing::warn!(
                        "Runtime {:?} exited early {} times; reverting to {target}",
                        state.current,
                        state.crash_count
                    );
                    state.revert_to(&target);
                    reverted_to = Some(target);
                }
                state.save(&self.layout.current_file()).ok();
            }
        }

        emit(&Event::Exited { code, reverted_to });
    }
}

/// Forward runtime output until the process is gone.
///
/// Runs on its own thread: the runtime announces its port seconds after
/// `start` returns, and a manager that only drained between commands would
/// swallow that event until the user happened to trigger another one.
pub fn pump_events(events: Receiver<RuntimeEvent>) {
    // `recv` blocks, so this thread costs nothing while the runtime is quiet
    // and ends on its own when the sender side drops.
    while let Ok(event) = events.recv() {
        match event {
            RuntimeEvent::Stdout(line) => emit(&Event::Log {
                stream: "stdout".into(),
                line,
            }),
            RuntimeEvent::Stderr(line) => emit(&Event::Log {
                stream: "stderr".into(),
                line,
            }),
            RuntimeEvent::Listening { url, port } => emit(&Event::Listening { url, port }),
            // The crash policy needs `&mut Manager`, so the exit event is
            // handled in `Manager::pump` off `poll_exit` instead.
            RuntimeEvent::Exited { .. } => break,
        }
    }
}

/// Where everything lives
pub fn paths_json(layout: &Layout) -> serde_json::Value {
    serde_json::json!({
        "root": layout.root(),
        "versions": layout.runtimes_dir(),
        "data": layout.state_dir(),
        "database": layout.pgdata_dir(),
        "uploads": layout.uploads_dir(),
        "cache": layout.cache_dir(),
        "logs": layout.logs_dir(),
        "config": layout.current_file(),
    })
}

/// How long to wait for the server to answer before giving up.
///
/// Generous on purpose: a first run initializes PostgreSQL and applies
/// every migration, which on an old laptop with a slow disk is minutes.
/// Timing out early would look identical to a real failure.
///
/// `TOP_RUNTIME_START_TIMEOUT` overrides it, which tests need: a fixture
/// runtime that exits immediately would otherwise block for the full
/// timeout.
pub fn startup_timeout() -> Duration {
    let seconds = std::env::var("TOP_RUNTIME_START_TIMEOUT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(300);
    Duration::from_secs(seconds)
}
