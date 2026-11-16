mod client;
mod forward;
mod host;

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{Context, Result};
use iroh::{endpoint::Endpoint, SecretKey};
use iroh_tickets::endpoint::EndpointTicket;
use tokio_util::sync::CancellationToken;

pub use client::{parse_peer, ClientStatus};
pub use forward::forward_bidi;

/// Dumbpipe's ALPN and handshake, so the `dumbpipe` CLI can talk to us directly.
pub const ALPN: &[u8] = b"DUMBPIPEV0";
pub const HANDSHAKE: [u8; 5] = *b"hello";

/// Without a relay we still work on the local network, so don't wait forever.
const ONLINE_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Clone)]
pub enum Target {
    Port(u16),
    /// The runtime's current port, read from its lock file on use, so a
    /// runtime that restarts on another port keeps the same tunnel.
    Runtime(PathBuf),
}

impl Target {
    pub fn resolve(&self) -> Result<SocketAddr> {
        let port = match self {
            Target::Port(port) => *port,
            Target::Runtime(root) => top_runtime_manager::storage::lock::read(root)
                .and_then(|lock| lock.http_port)
                .context("The local server is not running")?,
        };
        Ok(SocketAddr::from(([127, 0, 0, 1], port)))
    }
}

pub fn get_or_create_secret(data_dir: &Path) -> Result<SecretKey> {
    let key_path = data_dir.join("iroh_secret_key");

    if key_path.is_file() {
        let bytes = std::fs::read(&key_path).context("Failed to read the iroh secret key")?;
        let array: [u8; 32] = bytes
            .try_into()
            .map_err(|_| anyhow::anyhow!("The iroh secret key is the wrong length"))?;
        return Ok(SecretKey::from_bytes(&array));
    }

    let secret = SecretKey::generate();
    std::fs::create_dir_all(data_dir).context("Failed to create the data directory")?;
    std::fs::write(&key_path, secret.to_bytes()).context("Failed to write the iroh secret key")?;

    // Anyone with the key can impersonate this install.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(secret)
}

struct Hosting {
    resolver: Arc<host::Resolver>,
    /// Closes every accepted connection when hosting stops.
    stop: CancellationToken,
    ticket: String,
}

/// One endpoint for both hosting and joining: two endpoints with the same
/// key would knock each other off the relay.
struct Node {
    endpoint: Endpoint,
    hosting: Arc<Mutex<Option<Arc<Hosting>>>>,
}

impl Node {
    async fn bind(data_dir: &Path) -> Result<Self> {
        let secret = get_or_create_secret(data_dir)?;

        // n0's relays and DNS lookup make a bare endpoint ID reachable from
        // other networks.
        let endpoint = Endpoint::builder(iroh::endpoint::presets::N0)
            .secret_key(secret)
            .alpns(vec![ALPN.to_vec()])
            .bind()
            .await
            .context("Failed to create the iroh endpoint")?;

        if tokio::time::timeout(ONLINE_TIMEOUT, endpoint.online())
            .await
            .is_err()
        {
            tracing::warn!("No home relay within {ONLINE_TIMEOUT:?}; continuing");
        }
        tracing::info!("Endpoint id: {}", endpoint.id());

        let hosting: Arc<Mutex<Option<Arc<Hosting>>>> = Arc::default();
        let accept_endpoint = endpoint.clone();
        let accept_hosting = hosting.clone();
        tokio::spawn(async move {
            while let Some(incoming) = accept_endpoint.accept().await {
                let hosting = accept_hosting.lock().expect("hosting lock").clone();
                let Some(hosting) = hosting else {
                    incoming.refuse();
                    continue;
                };
                let accepting = match incoming.accept() {
                    Ok(accepting) => accepting,
                    Err(err) => {
                        tracing::warn!("Error accepting a connection: {err}");
                        continue;
                    }
                };
                tokio::spawn(async move {
                    let result = host::handle_connection(
                        accepting,
                        hosting.resolver.clone(),
                        hosting.stop.clone(),
                    )
                    .await;
                    if let Err(err) = result {
                        tracing::warn!("Tunnel connection failed: {err:#}");
                    }
                });
            }
            tracing::info!("Endpoint closed, stopping the accept loop");
        });

        Ok(Self { endpoint, hosting })
    }

    fn hosting(&self) -> Option<Arc<Hosting>> {
        self.hosting.lock().expect("hosting lock").clone()
    }

    fn host(&self, target: Target) {
        let hosting = Arc::new(Hosting {
            resolver: Arc::new(host::Resolver::new(target)),
            stop: CancellationToken::new(),
            ticket: EndpointTicket::new(self.endpoint.addr()).to_string(),
        });
        *self.hosting.lock().expect("hosting lock") = Some(hosting);
    }

    fn stop_hosting(&self) {
        if let Some(hosting) = self.hosting.lock().expect("hosting lock").take() {
            hosting.stop.cancel();
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RemoteStatus {
    /// Whether this install is hosting.
    pub enabled: bool,
    pub ticket: Option<String>,
    pub node_id: Option<String>,
    /// The host this install has joined, if any.
    pub client: Option<ClientStatus>,
}

impl RemoteStatus {
    pub fn off() -> Self {
        Self {
            enabled: false,
            ticket: None,
            node_id: None,
            client: None,
        }
    }
}

/// The endpoint is bound on first use and closed when neither hosting nor
/// joined, so an idle helper holds no relay connection.
pub struct Remote {
    runtime: Arc<tokio::runtime::Runtime>,
    node: Option<Node>,
    client: Option<client::Client>,
}

impl Remote {
    pub fn new() -> Result<Self> {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .context("Failed to start the async runtime for remote access")?;
        Ok(Self {
            runtime: Arc::new(runtime),
            node: None,
            client: None,
        })
    }

    pub fn status(&self) -> RemoteStatus {
        let hosting = self.node.as_ref().and_then(Node::hosting);
        RemoteStatus {
            enabled: hosting.is_some(),
            ticket: hosting.as_ref().map(|h| h.ticket.clone()),
            node_id: match (&hosting, &self.node) {
                (Some(_), Some(node)) => Some(node.endpoint.id().to_string()),
                _ => None,
            },
            client: self.client_status(),
        }
    }

    pub fn client_status(&self) -> Option<ClientStatus> {
        self.client.as_ref().map(client::Client::status)
    }

    fn node(&mut self, data_dir: &Path) -> Result<&Node> {
        if self.node.is_none() {
            let node = self.runtime.block_on(Node::bind(data_dir))?;
            self.node = Some(node);
        }
        Ok(self.node.as_ref().expect("just set"))
    }

    pub fn start(&mut self, target: Target, data_dir: PathBuf) -> Result<RemoteStatus> {
        let node = self.node(&data_dir)?;
        if node.hosting().is_none() {
            node.host(target);
            tracing::info!("Hosting");
        }
        Ok(self.status())
    }

    pub fn stop(&mut self) {
        if let Some(node) = &self.node {
            node.stop_hosting();
        }
        self.close_if_idle();
    }

    pub fn connect(
        &mut self,
        peer: &str,
        port: Option<u16>,
        data_dir: PathBuf,
    ) -> Result<ClientStatus> {
        let peer = parse_peer(peer)?;
        if let Some(client) = &self.client {
            let same_port = port.is_none_or(|port| port == client.port());
            if client.peer() == peer.id && same_port {
                return Ok(client.status());
            }
        }

        let endpoint = self.node(&data_dir)?.endpoint.clone();

        // Dial before dropping the current host, so a bad ticket keeps it.
        let connection = match self.runtime.block_on(client::dial(&endpoint, &peer)) {
            Ok(connection) => connection,
            Err(err) => {
                self.close_if_idle();
                return Err(err);
            }
        };

        // Close the old one first so the new one can bind the same port.
        self.disconnect_client();
        let served = self
            .runtime
            .block_on(client::serve(endpoint, peer, connection.clone(), port));
        match served {
            Ok(client) => {
                let status = client.status();
                self.client = Some(client);
                Ok(status)
            }
            Err(err) => {
                connection.close(0u32.into(), b"failed to serve");
                self.close_if_idle();
                Err(err)
            }
        }
    }

    pub fn disconnect(&mut self) {
        self.disconnect_client();
        self.close_if_idle();
    }

    fn disconnect_client(&mut self) {
        if let Some(client) = self.client.take() {
            self.runtime.block_on(client.close());
        }
    }

    fn close_if_idle(&mut self) {
        let hosting = self.node.as_ref().and_then(Node::hosting).is_some();
        if hosting || self.client.is_some() {
            return;
        }
        if let Some(node) = self.node.take() {
            self.runtime.block_on(node.endpoint.close());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_fixed_port_resolves_to_loopback() {
        let addr = Target::Port(4321).resolve().unwrap();
        assert_eq!(addr, SocketAddr::from(([127, 0, 0, 1], 4321)));
    }

    #[test]
    fn a_runtime_with_no_lock_is_not_running() {
        let root = tempfile::tempdir().unwrap();
        let err = Target::Runtime(root.path().to_path_buf())
            .resolve()
            .unwrap_err();
        assert!(err.to_string().contains("not running"));
    }

    #[test]
    fn a_runtime_target_follows_the_port_in_the_lock() {
        let root = tempfile::tempdir().unwrap();
        let lock = |port| top_runtime_manager::storage::lock::RuntimeLock {
            manager_pid: std::process::id(),
            runtime_pid: None,
            http_port: Some(port),
            version: None,
            holders: Vec::new(),
            remote: None,
        };
        let target = Target::Runtime(root.path().to_path_buf());

        top_runtime_manager::storage::lock::write(root.path(), &lock(5000)).unwrap();
        assert_eq!(target.resolve().unwrap().port(), 5000);

        top_runtime_manager::storage::lock::write(root.path(), &lock(5001)).unwrap();
        assert_eq!(target.resolve().unwrap().port(), 5001);
    }
}
