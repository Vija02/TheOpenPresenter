mod forward;

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use iroh::{endpoint::Accepting, endpoint::Endpoint, SecretKey};
use iroh_tickets::endpoint::EndpointTicket;
use tokio::net::TcpStream;
use tokio::select;
use tokio::sync::oneshot;

use forward::forward_bidi;

/// Dumbpipe's ALPN and handshake, so the `dumbpipe` CLI can talk to us directly.
pub const ALPN: &[u8] = b"DUMBPIPEV0";
pub const HANDSHAKE: [u8; 5] = *b"hello";

/// How long to wait for a home relay before giving up and carrying on.
/// A bridge without a relay still works on the local network.
const ONLINE_TIMEOUT: Duration = Duration::from_secs(10);

/// A running peer-to-peer tunnel to the local server.
pub struct Bridge {
    endpoint: Endpoint,
    shutdown: Option<oneshot::Sender<()>>,
    ticket: String,
    node_id: String,
}

impl Bridge {
    pub fn ticket(&self) -> &str {
        &self.ticket
    }

    pub fn node_id(&self) -> &str {
        &self.node_id
    }

    pub async fn shutdown(&mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
        self.endpoint.close().await;
    }
}

/// The node's long-lived identity.
fn get_or_create_secret(data_dir: &Path) -> Result<SecretKey> {
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

    // The key is the node's identity: anyone holding it can impersonate
    // this install, so keep it to the owner on platforms that can.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(secret)
}

/// Serve one incoming tunnel connection by splicing it onto the local port.
async fn handle_connection(accepting: Accepting, target: SocketAddr) -> Result<()> {
    let connection = accepting.await.context("Error accepting the connection")?;
    let remote = connection.remote_id();
    tracing::info!("Tunnel connection from {remote}");

    let (send, mut recv) = connection
        .accept_bi()
        .await
        .context("Error accepting a bidirectional stream")?;

    let mut handshake = [0u8; HANDSHAKE.len()];
    recv.read_exact(&mut handshake)
        .await
        .context("Error reading the handshake")?;
    if handshake != HANDSHAKE {
        anyhow::bail!("Invalid handshake from {remote}");
    }

    let tcp = TcpStream::connect(target)
        .await
        .with_context(|| format!("Error connecting to the local server at {target}"))?;

    let (read, write) = tcp.into_split();
    forward_bidi(read, write, recv, send).await?;

    tracing::info!("Tunnel connection from {remote} closed");
    Ok(())
}

/// Start a tunnel forwarding to a local TCP port.
pub async fn start(target: SocketAddr, data_dir: PathBuf) -> Result<Bridge> {
    let secret = get_or_create_secret(&data_dir)?;

    // `N0` is the production preset: n0's relays plus DNS-based discovery,
    // which is what makes a ticket work from another network without any
    // router configuration.
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
        // Not fatal: without a relay the tunnel still works on the local
        // network, which is better than refusing to start.
        tracing::warn!("No home relay within {ONLINE_TIMEOUT:?}; continuing");
    }

    let addr = endpoint.addr();
    let node_id = addr.id.to_string();
    let ticket = EndpointTicket::new(addr.clone()).to_string();

    tracing::info!("Remote access ready, forwarding to {target}");
    tracing::info!("Node id: {node_id}");

    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();

    let accept_endpoint = endpoint.clone();
    tokio::spawn(async move {
        loop {
            select! {
                incoming = accept_endpoint.accept() => {
                    let Some(incoming) = incoming else {
                        tracing::info!("Endpoint closed, stopping the accept loop");
                        break;
                    };
                    let accepting = match incoming.accept() {
                        Ok(c) => c,
                        Err(err) => {
                            tracing::warn!("Error accepting a connection: {err}");
                            continue;
                        }
                    };
                    tokio::spawn(async move {
                        if let Err(err) = handle_connection(accepting, target).await {
                            tracing::warn!("Tunnel connection failed: {err}");
                        }
                    });
                }
                _ = &mut shutdown_rx => {
                    tracing::info!("Stopping remote access");
                    break;
                }
            }
        }
    });

    Ok(Bridge {
        endpoint,
        shutdown: Some(shutdown_tx),
        ticket,
        node_id,
    })
}

/// Everything a shell needs to show about remote access.
#[derive(Debug, Clone, serde::Serialize)]
pub struct RemoteStatus {
    pub enabled: bool,
    pub ticket: Option<String>,
    pub node_id: Option<String>,
}

impl RemoteStatus {
    pub fn off() -> Self {
        Self {
            enabled: false,
            ticket: None,
            node_id: None,
        }
    }
}

/// Owns the bridge and the runtime it needs.
pub struct Remote {
    runtime: Arc<tokio::runtime::Runtime>,
    bridge: Option<Bridge>,
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
            bridge: None,
        })
    }

    pub fn status(&self) -> RemoteStatus {
        match &self.bridge {
            Some(bridge) => RemoteStatus {
                enabled: true,
                ticket: Some(bridge.ticket().to_string()),
                node_id: Some(bridge.node_id().to_string()),
            },
            None => RemoteStatus::off(),
        }
    }

    pub fn start(&mut self, target: SocketAddr, data_dir: PathBuf) -> Result<RemoteStatus> {
        if self.bridge.is_some() {
            // Already on: hand back the existing ticket rather than
            // building a second tunnel to the same server.
            return Ok(self.status());
        }
        let bridge = self.runtime.block_on(start(target, data_dir))?;
        self.bridge = Some(bridge);
        Ok(self.status())
    }

    pub fn stop(&mut self) {
        if let Some(mut bridge) = self.bridge.take() {
            self.runtime.block_on(bridge.shutdown());
        }
    }
}
