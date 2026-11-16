//! Hosting: splice incoming tunnel streams onto the local server.

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use iroh::endpoint::{Accepting, RecvStream, SendStream};
use tokio::net::TcpStream;
use tokio_util::sync::CancellationToken;

use super::{forward_bidi, Target, HANDSHAKE};

/// Resolving reads the lock file and checks pids (`tasklist` on Windows), and
/// a page load opens dozens of streams at once.
const RESOLVE_CACHE: Duration = Duration::from_secs(2);

pub(super) struct Resolver {
    target: Arc<Target>,
    cached: Mutex<Option<(SocketAddr, Instant)>>,
}

impl Resolver {
    pub(super) fn new(target: Target) -> Self {
        Self {
            target: Arc::new(target),
            cached: Mutex::new(None),
        }
    }

    async fn resolve(&self) -> Result<SocketAddr> {
        let cached = *self.cached.lock().expect("resolver lock");
        if let Some((addr, at)) = cached {
            if at.elapsed() < RESOLVE_CACHE {
                return Ok(addr);
            }
        }
        let target = self.target.clone();
        let addr = tokio::task::spawn_blocking(move || target.resolve())
            .await
            .context("Failed to look up the local server")??;
        *self.cached.lock().expect("resolver lock") = Some((addr, Instant::now()));
        Ok(addr)
    }

    fn forget(&self) {
        *self.cached.lock().expect("resolver lock") = None;
    }

    /// Retries once with a fresh lookup, in case the runtime just moved.
    async fn connect(&self) -> Result<TcpStream> {
        let addr = self.resolve().await?;
        if let Ok(tcp) = TcpStream::connect(addr).await {
            return Ok(tcp);
        }
        self.forget();
        let addr = self.resolve().await?;
        TcpStream::connect(addr)
            .await
            .with_context(|| format!("Error connecting to the local server at {addr}"))
    }
}

/// Each bidirectional stream is one TCP connection. `dumbpipe` opens one per
/// connection; a joining Studio opens many on one.
pub(super) async fn handle_connection(
    accepting: Accepting,
    resolver: Arc<Resolver>,
    stop: CancellationToken,
) -> Result<()> {
    let connection = accepting.await.context("Error accepting the connection")?;
    let remote = connection.remote_id();
    tracing::info!("Tunnel connection from {remote}");

    loop {
        let stream = tokio::select! {
            stream = connection.accept_bi() => stream,
            _ = stop.cancelled() => {
                connection.close(0u32.into(), b"remote access stopped");
                break;
            }
        };
        let (send, recv) = match stream {
            Ok(stream) => stream,
            Err(_) => break,
        };
        let resolver = resolver.clone();
        tokio::spawn(async move {
            if let Err(err) = handle_stream(send, recv, &resolver).await {
                tracing::warn!("Tunnel stream from {remote} failed: {err:#}");
            }
        });
    }

    tracing::info!("Tunnel connection from {remote} closed");
    Ok(())
}

async fn handle_stream(send: SendStream, mut recv: RecvStream, resolver: &Resolver) -> Result<()> {
    let mut handshake = [0u8; HANDSHAKE.len()];
    recv.read_exact(&mut handshake)
        .await
        .context("Error reading the handshake")?;
    if handshake != HANDSHAKE {
        anyhow::bail!("Invalid handshake");
    }

    let tcp = resolver.connect().await?;
    let (read, write) = tcp.into_split();
    forward_bidi(read, write, recv, send).await
}
