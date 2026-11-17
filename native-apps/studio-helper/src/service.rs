//! State shared by the NDJSON protocol and the CLI. Nothing here prints.

use std::time::{Duration, Instant};

use anyhow::{bail, Result};
use top_runtime_manager::storage::lock::{self, RemoteInfo};
use top_runtime_manager::Layout;

use crate::protocol::Command;
use crate::remote::{hostname, EventSink, Remote, RemoteStatus, Target};

/// Slow on purpose: reading the lock checks pids (`tasklist` on Windows).
const REPUBLISH_EVERY: Duration = Duration::from_secs(5);

pub struct Helper {
    pub layout: Layout,
    remote: Option<Remote>,
    last_republish: Option<Instant>,
    events: EventSink,
}

impl Helper {
    pub fn new(layout: Layout) -> Self {
        Self::with_events(layout, std::sync::Arc::new(|_| {}))
    }

    /// `events` receives discovery events, from another thread.
    pub fn with_events(layout: Layout, events: EventSink) -> Self {
        Self {
            layout,
            remote: None,
            last_republish: None,
            events,
        }
    }

    pub fn handle(&mut self, command: Command) -> Result<serde_json::Value> {
        match command {
            Command::RemoteStart { port, name } => self.remote_start(port, name),
            Command::RemoteStop => self.remote_stop(),
            Command::RemoteStatus => self.remote_status(),
            Command::RemoteConnect { peer, port } => self.remote_connect(&peer, port),
            Command::RemoteDisconnect => self.remote_disconnect(),
            Command::DiscoverStart => {
                self.ensure_identity_free()?;
                let data_dir = self.layout.state_dir();
                let hosts = self.remote()?.discover_start(data_dir)?;
                Ok(serde_json::json!({ "hosts": hosts }))
            }
            Command::DiscoverStop => {
                if let Some(remote) = &mut self.remote {
                    remote.discover_stop();
                }
                Ok(serde_json::json!({ "hosts": [] }))
            }
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

    /// Refused without a running server: the ticket would fail on first use.
    fn remote_start(
        &mut self,
        port: Option<u16>,
        name: Option<String>,
    ) -> Result<serde_json::Value> {
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

        // Another process sharing this runtime already hosts it: reuse that.
        if let Some(info) = lock::remote(&root) {
            if info.owner_pid != std::process::id() {
                return Ok(serde_json::to_value(RemoteStatus {
                    enabled: true,
                    ticket: Some(info.ticket),
                    node_id: Some(info.node_id),
                    client: self.client_status(),
                })?);
            }
        }

        let data_dir = self.layout.state_dir();
        // Replies are size-capped, so a long name would hide the host.
        let name: String = name
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty())
            .unwrap_or_else(hostname)
            .chars()
            .take(64)
            .collect();
        let status = self.remote()?.start(target, name, data_dir)?;

        self.publish(&status);
        Ok(serde_json::to_value(status)?)
    }

    fn remote(&mut self) -> Result<&mut Remote> {
        if self.remote.is_none() {
            self.remote = Some(Remote::new(self.events.clone())?);
        }
        Ok(self.remote.as_mut().expect("just set"))
    }

    fn remote_stop(&mut self) -> Result<serde_json::Value> {
        if let Some(remote) = &mut self.remote {
            remote.stop();
        }
        self.unpublish();
        // Off even if another app still hosts, or the toggle would snap back.
        Ok(serde_json::to_value(RemoteStatus {
            client: self.client_status(),
            ..RemoteStatus::off()
        })?)
    }

    /// Needs no local server.
    /// Joining and browsing bring up this install's identity. If another
    /// process is hosting with it, the relay would drop one of us.
    fn ensure_identity_free(&self) -> Result<()> {
        if let Some(info) = lock::remote(self.layout.root()) {
            if info.owner_pid != std::process::id() {
                bail!("Another app on this computer is sharing. Turn that off first.");
            }
        }
        Ok(())
    }

    fn remote_connect(&mut self, peer: &str, port: Option<u16>) -> Result<serde_json::Value> {
        self.ensure_identity_free()?;
        let data_dir = self.layout.state_dir();
        let status = self.remote()?.connect(peer, port, data_dir)?;
        Ok(serde_json::to_value(status)?)
    }

    fn remote_disconnect(&mut self) -> Result<serde_json::Value> {
        if let Some(remote) = &mut self.remote {
            remote.disconnect();
        }
        self.remote_status()
    }

    fn client_status(&self) -> Option<crate::remote::ClientStatus> {
        self.remote.as_ref().and_then(Remote::client_status)
    }

    fn remote_status(&self) -> Result<serde_json::Value> {
        // Fall back to the lock, to show a tunnel another app opened.
        let status = match self.ours() {
            Some(status) => status,
            None => match lock::remote(self.layout.root()) {
                Some(info) => RemoteStatus {
                    enabled: true,
                    ticket: Some(info.ticket),
                    node_id: Some(info.node_id),
                    client: self.client_status(),
                },
                None => RemoteStatus {
                    client: self.client_status(),
                    ..RemoteStatus::off()
                },
            },
        };
        Ok(serde_json::to_value(status)?)
    }

    /// A restarted runtime writes a fresh lock without our tunnel; put it back.
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
            return;
        };
        // Someone else's live tunnel wins.
        if current.remote.is_none() {
            self.publish(&status);
        }
    }

    pub fn shutdown(&mut self) {
        let _ = self.remote_stop();
        let _ = self.remote_disconnect();
        let _ = self.handle(Command::DiscoverStop);
    }

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

    /// Only if it's ours: another app's tunnel must stay visible.
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
            .handle(Command::RemoteStart {
                port: None,
                name: None,
            })
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
        // A live pid that isn't ours.
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

        let started = helper
            .handle(Command::RemoteStart {
                port: None,
                name: None,
            })
            .unwrap();
        assert_eq!(started["ticket"], "endpointabc");
        assert!(helper.ours().is_none());

        let err = helper
            .handle(Command::RemoteConnect {
                peer: "abc".into(),
                port: None,
            })
            .unwrap_err();
        assert!(err.to_string().contains("Another app"));
        let err = helper.handle(Command::DiscoverStart).unwrap_err();
        assert!(err.to_string().contains("Another app"));

        let stopped = helper.handle(Command::RemoteStop).unwrap();
        assert_eq!(stopped["enabled"], false);
        assert!(lock::remote(root.path()).is_some());
    }
}
