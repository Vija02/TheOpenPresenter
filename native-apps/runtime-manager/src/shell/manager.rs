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
    /// Who currently wants the runtime up.
    holders: std::collections::BTreeSet<String>,
    /// What the running runtime is serving
    running: Option<(u16, String)>,
    /// Remote access
    #[cfg(feature = "remote")]
    remote: Option<crate::remote::Remote>,
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
            holders: std::collections::BTreeSet::new(),
            running: None,
            #[cfg(feature = "remote")]
            remote: None,
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
            Command::Start { holder } => self.start(holder),
            Command::Stop { holder, force } => self.stop(holder, force),
            Command::Remove { version } => {
                // Deleting the files out from under a running server would
                // leave a process serving a directory that no longer
                // exists, and PostgreSQL holding its port.
                let active = self.state().ok().and_then(|s| s.current);
                if self.supervisor.is_some() && active.as_deref() == Some(version.as_str()) {
                    if let Some(supervisor) = self.supervisor.take() {
                        supervisor.stop().ok();
                    }
                    self.running = None;
                    self.holders.clear();
                    crate::storage::lock::release(self.layout.root());
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
            Command::RemoteStart => self.remote_start(),
            Command::RemoteStop => self.remote_stop(),
            Command::RemoteStatus => self.remote_status(),
            Command::Shutdown => {
                self.holders.clear();
                let unheld = crate::storage::lock::release(self.layout.root());

                if unheld {
                    if let Some(supervisor) = self.supervisor.take() {
                        supervisor.stop().ok();
                    }
                    self.running = None;
                } else {
                    // Deliberately leaked: dropping the Supervisor would
                    // close the runtime's stdin, and killing it here is
                    // exactly what the remaining holders are asking us not
                    // to do. TOP_MANAGED tells the runtime to ignore the
                    // closed pipe.
                    std::mem::forget(self.supervisor.take());
                }

                Ok(serde_json::json!({
                    "shuttingDown": true,
                    "runtimeStopped": unheld,
                }))
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
            "managerVersion": env!("CARGO_PKG_VERSION"),
        }))
    }

    /// Start peer-to-peer remote access to the running server.
    ///
    /// Requires the server to be up: the tunnel forwards to its port, and
    /// a tunnel to nothing would hand out a ticket that fails on first use.
    #[cfg(feature = "remote")]
    fn remote_start(&mut self) -> Result<serde_json::Value> {
        let Some((port, _)) = self.running else {
            bail!("Start the server before turning on remote access");
        };

        // Another process sharing this runtime already has a tunnel to it.
        // Hand back the same ticket rather than opening a second one to
        // the same server, which would waste a relay connection and give
        // out two addresses for one machine.
        if let Some(info) = crate::storage::lock::remote(self.layout.root()) {
            if info.owner_pid != std::process::id() {
                return Ok(serde_json::json!({
                    "enabled": true,
                    "ticket": info.ticket,
                    "node_id": info.node_id,
                }));
            }
        }

        let remote = match &mut self.remote {
            Some(remote) => remote,
            None => {
                self.remote = Some(crate::remote::Remote::new()?);
                self.remote.as_mut().expect("just set")
            }
        };

        let target = std::net::SocketAddr::from(([127, 0, 0, 1], port));
        let status = remote.start(target, self.layout.state_dir())?;

        // Publish it so other processes sharing this runtime can see that
        // remote access is on and show the same ticket.
        if let (Some(ticket), Some(node_id)) = (&status.ticket, &status.node_id) {
            crate::storage::lock::set_remote(
                self.layout.root(),
                Some(crate::storage::lock::RemoteInfo {
                    ticket: ticket.clone(),
                    node_id: node_id.clone(),
                    owner_pid: std::process::id(),
                }),
            );
        }

        Ok(serde_json::to_value(status)?)
    }

    #[cfg(feature = "remote")]
    fn remote_stop(&mut self) -> Result<serde_json::Value> {
        if let Some(remote) = &mut self.remote {
            remote.stop();
        }
        // Only clear the shared entry if this process owns the tunnel.
        // Another app may be running one, and stopping ours must not make
        // theirs invisible.
        if let Some(info) = crate::storage::lock::remote(self.layout.root()) {
            if info.owner_pid == std::process::id() {
                crate::storage::lock::set_remote(self.layout.root(), None);
            }
        }
        Ok(serde_json::to_value(crate::remote::RemoteStatus::off())?)
    }

    #[cfg(feature = "remote")]
    fn remote_status(&self) -> Result<serde_json::Value> {
        // Ours if we opened it, otherwise whatever the lock says: a
        // second app joining a shared runtime has to see the tunnel the
        // first one opened, not report remote access as off.
        let status = match &self.remote {
            Some(remote) if remote.status().enabled => remote.status(),
            _ => match crate::storage::lock::remote(self.layout.root()) {
                Some(info) => crate::remote::RemoteStatus {
                    enabled: true,
                    ticket: Some(info.ticket),
                    node_id: Some(info.node_id),
                },
                None => crate::remote::RemoteStatus::off(),
            },
        };
        Ok(serde_json::to_value(status)?)
    }

    // Without the feature the commands still exist on the protocol, so a
    // shell built against a full manager gets a clear answer instead of an
    // unknown-command error.
    #[cfg(not(feature = "remote"))]
    fn remote_start(&mut self) -> Result<serde_json::Value> {
        bail!("This build has no remote access support")
    }

    #[cfg(not(feature = "remote"))]
    fn remote_stop(&mut self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({ "enabled": false }))
    }

    #[cfg(not(feature = "remote"))]
    fn remote_status(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({ "enabled": false, "supported": false }))
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

    /// Release a holder, stopping the runtime when the last one lets go.
    fn stop(&mut self, holder: Option<String>, force: bool) -> Result<serde_json::Value> {
        let name = holder.unwrap_or_else(|| "default".into());
        self.holders.remove(&name);

        if force {
            self.holders.clear();
        } else if !self.holders.is_empty() {
            // Someone else still wants it. Saying so beats a silent no-op
            // when a caller is working out why the server is still up.
            return Ok(serde_json::json!({
                "stopped": false,
                "holders": self.holders.iter().collect::<Vec<_>>(),
            }));
        }

        // Read the runtime's pid before releasing: the last release
        // deletes the file, and a joined runtime can only be stopped by
        // pid because its pipes belong to another process.
        let foreign_pid = crate::storage::lock::read(self.layout.root())
            .filter(|_| self.supervisor.is_none())
            .and_then(|l| l.runtime_pid);

        // The file is the cross-process view; the in-memory set only knows
        // about this manager. A runtime is stopped only when both agree
        // nobody wants it.
        let unheld = crate::storage::lock::release(self.layout.root());
        if !unheld && !force {
            return Ok(serde_json::json!({
                "stopped": false,
                "holders": self.holders.iter().collect::<Vec<_>>(),
                "heldElsewhere": true,
            }));
        }

        if let Some(supervisor) = self.supervisor.take() {
            supervisor.stop()?;
        } else if let Some(pid) = foreign_pid {
            // A runtime we joined rather than spawned: its pipes belong to
            // a process that may be gone, so signal it instead. Left alone
            // it would outlive every holder, which is the stale server the
            // lock file exists to prevent.
            stop_by_pid(pid);
        }
        self.running = None;
        Ok(serde_json::json!({ "stopped": true, "holders": [] }))
    }

    fn start(&mut self, holder: Option<String>) -> Result<serde_json::Value> {
        let name = holder.unwrap_or_else(|| "default".into());

        if self
            .supervisor
            .as_ref()
            .map(|s| s.exited())
            .unwrap_or(false)
        {
            self.supervisor = None;
            self.running = None;
            self.holders.clear();
        }

        // Already serving: adopt the caller as another holder
        if let Some((port, version)) = self.running.clone() {
            self.holders.insert(name);
            return Ok(serde_json::json!({
                "url": format!("http://localhost:{port}"),
                "httpPort": port,
                "version": version,
                "reused": true,
                "holders": self.holders.iter().collect::<Vec<_>>(),
            }));
        }

        // Someone else may already be serving this root
        if let Some(existing) = crate::storage::lock::read(self.layout.root()) {
            if let (Some(port), true) = (
                existing.http_port,
                existing
                    .runtime_pid
                    .map(crate::storage::lock::process_alive)
                    .unwrap_or(false),
            ) {
                let lock = crate::storage::lock::RuntimeLock {
                    manager_pid: existing.manager_pid,
                    runtime_pid: existing.runtime_pid,
                    http_port: Some(port),
                    version: existing.version.clone(),
                    holders: existing.holders.clone(),
                    remote: existing.remote.clone(),
                };
                crate::storage::lock::hold(self.layout.root(), &name, &lock)?;
                self.holders.insert(name);
                self.running = Some((port, existing.version.clone().unwrap_or_default()));
                return Ok(serde_json::json!({
                    "url": format!("http://localhost:{port}"),
                    "httpPort": port,
                    "version": existing.version.unwrap_or_default(),
                    "reused": true,
                    "foreign": true,
                    "holders": self.holders.iter().collect::<Vec<_>>(),
                }));
            }
        }

        // Registered only once the runtime is actually up
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
            // Poll the port in short slices, so a process that dies is noticed
            let start = std::time::Instant::now();
            loop {
                if wait_for_http(config.http_port, Duration::from_millis(100)) {
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

        self.running = Some((config.http_port, version.clone()));
        self.holders.insert(name.clone());
        let _ = crate::storage::lock::hold(
            self.layout.root(),
            &name,
            &crate::storage::lock::RuntimeLock {
                manager_pid: std::process::id(),
                runtime_pid: self.supervisor.as_ref().and_then(|s| s.pid()),
                http_port: Some(config.http_port),
                version: Some(version.clone()),
                holders: Vec::new(),
                remote: None,
            },
        );

        Ok(serde_json::json!({
            "version": version,
            "httpPort": config.http_port,
            "pgPort": config.pg_port,
            "url": format!("http://localhost:{}", config.http_port),
            "reused": false,
            "holders": self.holders.iter().collect::<Vec<_>>(),
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
        self.running = None;
        self.holders.clear();
        crate::storage::lock::release(self.layout.root());

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

/// Stop a runtime this process did not spawn.
///
/// Its stdin belongs to whoever launched it, which may be gone, so the
/// only handle left is its pid. SIGTERM lets `run_server.mjs` shut
/// PostgreSQL down cleanly; killing outright would leave the data
/// directory locked and break the next launch.
fn stop_by_pid(pid: u32) {
    #[cfg(unix)]
    // Safety: SIGTERM to a pid recorded by a manager; the runtime installs
    // a handler for it and exits cleanly.
    unsafe {
        libc::kill(pid as libc::pid_t, libc::SIGTERM);
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output();
    }

    // The same grace a supervised stop gets, so PostgreSQL can close its
    // files before anything else opens the directory.
    let deadline = std::time::Instant::now() + Duration::from_secs(20);
    while std::time::Instant::now() < deadline {
        if !crate::storage::lock::process_alive(pid) {
            return;
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    tracing::warn!(pid, "A joined runtime did not exit after SIGTERM");
}
