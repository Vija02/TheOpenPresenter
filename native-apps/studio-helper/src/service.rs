//! The stateful core behind both the NDJSON protocol and the CLI, so the two
//! front ends cannot drift apart. Nothing here prints.

use std::time::{Duration, Instant};

use anyhow::{bail, Result};
use top_runtime_manager::storage::lock::{self, RemoteInfo};
use top_runtime_manager::Layout;

use crate::protocol::Command;
use crate::remote::{Remote, RemoteStatus, Target};

/// How often `pump` checks that the lock file still advertises our tunnel.
/// Slow on purpose: reading the lock checks pids, which on Windows means
/// running `tasklist`.
const REPUBLISH_EVERY: Duration = Duration::from_secs(5);

pub struct Helper {
    pub layout: Layout,
    remote: Option<Remote>,
    last_republish: Option<Instant>,
}

impl Helper {
    pub fn new(layout: Layout) -> Self {
        Self {
            layout,
            remote: None,
            last_republish: None,
        }
    }

    pub fn handle(&mut self, command: Command) -> Result<serde_json::Value> {
        match command {
            Command::RemoteStart { port } => self.remote_start(port),
            Command::RemoteStop => self.remote_stop(),
            Command::RemoteStatus => self.remote_status(),
            Command::Shutdown => {
                self.shutdown();
                Ok(serde_json::json!({ "shuttingDown": true }))
            }
        }
    }

    fn ours(&self) -> Option<RemoteStatus> {
        self.remote
            .as_ref()
            .map(Remote::status)
            .filter(|status| status.enabled)
    }

    /// Start peer-to-peer remote access to the running server.
    ///
    /// Requires the server to be up: a tunnel to nothing would hand out a
    /// ticket that fails on first use.
    fn remote_start(&mut self, port: Option<u16>) -> Result<serde_json::Value> {
        if let Some(status) = self.ours() {
            return Ok(serde_json::to_value(status)?);
        }

        let root = self.layout.root().to_path_buf();
        let target = match port {
            Some(port) => Target::Port(port),
            None => Target::Runtime(root.clone()),
        };
        if target.resolve().is_err() {
            bail!("Start the server before turning on remote access");
        }

        // Another process sharing this runtime already has a tunnel to it.
        // Hand back the same ticket rather than opening a second one to the
        // same server, which would waste a relay connection and give out two
        // addresses for one machine.
        if let Some(info) = lock::remote(&root) {
            if info.owner_pid != std::process::id() {
                return Ok(serde_json::json!({
                    "enabled": true,
                    "ticket": info.ticket,
                    "node_id": info.node_id,
                }));
            }
        }

        if self.remote.is_none() {
            self.remote = Some(Remote::new()?);
        }
        let remote = self.remote.as_mut().expect("just set");
        let status = remote.start(target, self.layout.state_dir())?;

        self.publish(&status);
        Ok(serde_json::to_value(status)?)
    }

    fn remote_stop(&mut self) -> Result<serde_json::Value> {
        if let Some(remote) = &mut self.remote {
            remote.stop();
        }
        self.unpublish();
        Ok(serde_json::to_value(RemoteStatus::off())?)
    }

    fn remote_status(&self) -> Result<serde_json::Value> {
        // Ours if we opened it, otherwise whatever the lock says: a second
        // app sharing the runtime has to see the tunnel the first one opened,
        // not report remote access as off.
        let status = match self.ours() {
            Some(status) => status,
            None => match lock::remote(self.layout.root()) {
                Some(info) => RemoteStatus {
                    enabled: true,
                    ticket: Some(info.ticket),
                    node_id: Some(info.node_id),
                },
                None => RemoteStatus::off(),
            },
        };
        Ok(serde_json::to_value(status)?)
    }

    /// Keep the lock advertising our tunnel.
    ///
    /// A runtime that stops and starts again writes a fresh lock with no
    /// remote entry, which would leave other processes reporting remote
    /// access as off while the tunnel is still serving.
    pub fn pump(&mut self) {
        if self
            .last_republish
            .is_some_and(|at| at.elapsed() < REPUBLISH_EVERY)
        {
            return;
        }
        self.last_republish = Some(Instant::now());

        let Some(status) = self.ours() else {
            return;
        };
        let root = self.layout.root();
        let Some(current) = lock::read(root) else {
            // No runtime: nothing to advertise to.
            return;
        };
        // Someone else's live tunnel wins; `read` already dropped dead ones.
        if current.remote.is_none() {
            self.publish(&status);
        }
    }

    /// Stop everything this process owns, before exiting.
    pub fn shutdown(&mut self) {
        let _ = self.remote_stop();
    }

    /// Record our tunnel in the lock, so other processes sharing this
    /// runtime can see that remote access is on and show the same ticket.
    fn publish(&self, status: &RemoteStatus) {
        if let (Some(ticket), Some(node_id)) = (&status.ticket, &status.node_id) {
            lock::set_remote(
                self.layout.root(),
                Some(RemoteInfo {
                    ticket: ticket.clone(),
                    node_id: node_id.clone(),
                    owner_pid: std::process::id(),
                }),
            );
        }
    }

    /// Clear the lock's entry, but only if it is ours. Another app may be
    /// running a tunnel, and stopping ours must not make theirs invisible.
    fn unpublish(&self) {
        if let Some(info) = lock::remote(self.layout.root()) {
            if info.owner_pid == std::process::id() {
                lock::set_remote(self.layout.root(), None);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn live_lock(port: Option<u16>, remote: Option<RemoteInfo>) -> lock::RuntimeLock {
        lock::RuntimeLock {
            manager_pid: std::process::id(),
            runtime_pid: None,
            http_port: port,
            version: None,
            holders: Vec::new(),
            remote,
        }
    }

    #[test]
    fn starting_without_a_running_server_is_refused() {
        let root = tempfile::tempdir().unwrap();
        let mut helper = Helper::new(Layout::new(root.path()));
        let err = helper
            .handle(Command::RemoteStart { port: None })
            .unwrap_err();
        assert!(err.to_string().contains("Start the server"));
    }

    #[test]
    fn status_is_off_with_nothing_running() {
        let root = tempfile::tempdir().unwrap();
        let mut helper = Helper::new(Layout::new(root.path()));
        let status = helper.handle(Command::RemoteStatus).unwrap();
        assert_eq!(status["enabled"], false);
    }

    #[cfg(unix)]
    #[test]
    fn another_processs_tunnel_is_reported_and_reused() {
        let root = tempfile::tempdir().unwrap();
        // A live pid that isn't ours: our parent, the test runner's shell
        // or cargo, which outlives this test.
        let other = std::os::unix::process::parent_id();
        let info = RemoteInfo {
            ticket: "endpointabc".into(),
            node_id: "abc".into(),
            owner_pid: other,
        };
        lock::write(root.path(), &live_lock(Some(5000), Some(info))).unwrap();

        let mut helper = Helper::new(Layout::new(root.path()));
        let status = helper.handle(Command::RemoteStatus).unwrap();
        assert_eq!(status["enabled"], true);
        assert_eq!(status["ticket"], "endpointabc");

        // Starting hands back the same ticket instead of a second tunnel.
        let started = helper.handle(Command::RemoteStart { port: None }).unwrap();
        assert_eq!(started["ticket"], "endpointabc");
        assert!(helper.ours().is_none());

        // And stopping ours leaves theirs alone.
        helper.handle(Command::RemoteStop).unwrap();
        assert!(lock::remote(root.path()).is_some());
    }
}
