mod utils;

use anyhow::{Context, Result};
use iroh::{
    endpoint::{Accepting, Endpoint},
    SecretKey,
};
use iroh_base::PublicKey;
use iroh_tickets::endpoint::EndpointTicket;
use std::{net::SocketAddrV4, path::PathBuf, sync::Arc, time::Duration};
use tokio::{
    net::TcpStream,
    select,
    sync::{oneshot, Mutex},
};

use utils::forward_bidi;

/// Default ALPN protocol for our bridge
/// Just use Dumbpipe APLN and HANDSHAKE so we can simply use dumbpipe cli
pub const ALPN: &[u8] = b"DUMBPIPEV0";

/// Handshake bytes to verify connection
pub const HANDSHAKE: [u8; 5] = *b"hello";

/// Timeout for waiting for the endpoint to be online
const ONLINE_TIMEOUT: Duration = Duration::from_secs(10);

/// Holds the state of the iroh bridge
pub struct IrohBridge {
    endpoint: Endpoint,
    shutdown_tx: Option<oneshot::Sender<()>>,
    ticket: String,
    node_id: PublicKey,
}

impl IrohBridge {
    /// Get the connection ticket string
    pub fn ticket(&self) -> &str {
        &self.ticket
    }

    /// Get the node ID
    pub fn node_id(&self) -> PublicKey {
        self.node_id
    }

    /// Shutdown the bridge
    pub async fn shutdown(&mut self) -> Result<()> {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        self.endpoint.close().await;
        Ok(())
    }
}

/// Get or create a secret key for the iroh endpoint
fn get_or_create_secret(data_dir: &PathBuf) -> Result<SecretKey> {
    let key_path = data_dir.join("iroh_secret_key");

    if key_path.exists() {
        let key_bytes = std::fs::read(&key_path).context("Failed to read secret key")?;
        let key_array: [u8; 32] = key_bytes
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid secret key length"))?;
        Ok(SecretKey::from_bytes(&key_array))
    } else {
        let secret_key = SecretKey::generate(&mut rand::rng());
        std::fs::create_dir_all(data_dir).context("Failed to create data directory")?;
        std::fs::write(&key_path, secret_key.to_bytes()).context("Failed to write secret key")?;
        Ok(secret_key)
    }
}

/// Create an iroh endpoint
async fn create_endpoint(secret_key: SecretKey, alpn: Vec<u8>) -> Result<Endpoint> {
    let endpoint = Endpoint::builder()
        .secret_key(secret_key)
        .alpns(vec![alpn])
        .bind()
        .await
        .context("Failed to create iroh endpoint")?;

    Ok(endpoint)
}

/// Handle an incoming iroh connection
async fn handle_connection(accepting: Accepting, target_addr: SocketAddrV4) -> Result<()> {
    let connection = accepting.await.context("Error accepting connection")?;
    let remote_id = connection.remote_id();
    tracing::info!("Got connection from {}", remote_id);

    let (mut send, mut recv) = connection
        .accept_bi()
        .await
        .context("Error accepting bidirectional stream")?;

    tracing::info!("Accepted bidi stream from {}", remote_id);

    // Read and verify handshake
    let mut handshake_buf = [0u8; HANDSHAKE.len()];
    recv.read_exact(&mut handshake_buf)
        .await
        .context("Error reading handshake")?;

    if handshake_buf != HANDSHAKE {
        anyhow::bail!("Invalid handshake received");
    }

    // Connect to local TCP server
    let tcp_stream = TcpStream::connect(target_addr).await.context(format!(
        "Error connecting to local server at {}",
        target_addr
    ))?;

    tracing::info!("Connected to local server at {}", target_addr);

    let (tcp_read, tcp_write) = tcp_stream.into_split();
    forward_bidi(tcp_read, tcp_write, recv, send).await?;

    tracing::info!("Connection from {} closed", remote_id);
    Ok(())
}

/// Start the iroh bridge that forwards connections to a local TCP address
pub async fn start_bridge(
    target_addr: SocketAddrV4,
    data_dir: PathBuf,
) -> Result<Arc<Mutex<IrohBridge>>> {
    let secret_key = get_or_create_secret(&data_dir)?;
    let endpoint = create_endpoint(secret_key, ALPN.to_vec()).await?;

    // Wait for the endpoint to be online
    if (tokio::time::timeout(ONLINE_TIMEOUT, endpoint.online()).await).is_err() {
        tracing::warn!("Warning: Failed to connect to home relay within timeout");
    }

    // Get the endpoint address and create a ticket
    let addr = endpoint.addr();
    let node_id = addr.id;
    let ticket = EndpointTicket::new(addr.clone());
    let ticket_string = ticket.to_string();

    tracing::info!("Iroh bridge started");
    tracing::info!("Node ID: {}", node_id);
    tracing::info!("Forwarding to: {}", target_addr);
    tracing::info!("Connection ticket: {}", ticket_string);

    if let Some(relay_url) = addr.relay_urls().next() {
        tracing::info!("Relay URL: {}", relay_url);
    }

    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();

    let bridge = Arc::new(Mutex::new(IrohBridge {
        endpoint: endpoint.clone(),
        shutdown_tx: Some(shutdown_tx),
        ticket: ticket_string,
        node_id,
    }));

    // Spawn the accept loop
    let endpoint_clone = endpoint.clone();
    tokio::spawn(async move {
        loop {
            select! {
                incoming = endpoint_clone.accept() => {
                    let Some(incoming) = incoming else {
                        tracing::info!("Endpoint closed, stopping accept loop");
                        break;
                    };
                    let accepting = match incoming.accept() {
                        Ok(c) => c,
                        Err(e) => {
                            tracing::warn!("Error accepting incoming connection: {}", e);
                            continue;
                        }
                    };

                    tokio::spawn(async move {
                        if let Err(e) = handle_connection(accepting, target_addr).await {
                            tracing::warn!("Error handling connection: {}", e);
                        }
                    });
                }
                _ = &mut shutdown_rx => {
                    tracing::info!("Shutdown signal received, stopping accept loop");
                    break;
                }
            }
        }
    });

    Ok(bridge)
}
