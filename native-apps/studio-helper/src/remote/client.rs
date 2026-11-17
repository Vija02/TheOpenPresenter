//! Joining: serve a host's app on a local port. Each local TCP connection is
//! one stream on a single QUIC connection; if it drops, the next TCP
//! connection dials again.

use std::io;
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use iroh::endpoint::{Connection, Endpoint};
use iroh::{EndpointAddr, EndpointId};
use tokio::net::{TcpListener, TcpStream};
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

use super::{forward_bidi, ALPN, HANDSHAKE};

/// Kept short: the helper handles one command at a time.
const DIAL_TIMEOUT: Duration = Duration::from_secs(10);

/// After a failed dial, fail fast rather than have every queued request dial.
const RETRY_AFTER_FAILURE: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct ClientStatus {
    pub peer: String,
    /// From the host's info reply; `None` for hosts that don't answer it.
    pub name: Option<String>,
    pub local_url: String,
    /// False between a drop and the next request, which dials again.
    pub connected: bool,
}

pub struct Client {
    dialer: Arc<Dialer>,
    name: Option<String>,
    port: u16,
    task: JoinHandle<()>,
}

impl Client {
    pub fn peer(&self) -> EndpointId {
        self.dialer.peer.id
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn status(&self) -> ClientStatus {
        ClientStatus {
            peer: self.peer().to_string(),
            name: self.name.clone(),
            local_url: format!("http://localhost:{}", self.port),
            connected: self.dialer.live().is_some(),
        }
    }

    /// Returns once the local port is free to bind again.
    pub async fn close(self) {
        self.dialer.close();
        let _ = self.task.await;
    }
}

/// A ticket or a bare endpoint ID.
pub fn parse_peer(text: &str) -> Result<EndpointAddr> {
    let text = text.trim();
    if let Ok(ticket) = text.parse::<iroh_tickets::endpoint::EndpointTicket>() {
        return Ok(ticket.into());
    }
    let id: EndpointId = text
        .parse()
        .context("That isn't a ticket or an endpoint ID")?;
    Ok(id.into())
}

pub async fn dial(endpoint: &Endpoint, peer: &EndpointAddr) -> Result<Connection> {
    if peer.id == endpoint.id() {
        anyhow::bail!("That's this computer");
    }

    let attempt = |addr: EndpointAddr| async move {
        tokio::time::timeout(DIAL_TIMEOUT, endpoint.connect(addr, ALPN))
            .await
            .map_err(|_| anyhow::anyhow!("timed out"))?
            .map_err(anyhow::Error::from)
    };

    match attempt(peer.clone()).await {
        Ok(connection) => Ok(connection),
        // A ticket's addresses go stale; the ID doesn't. Look it up.
        Err(err) if !peer.is_empty() => {
            tracing::info!("Dialing with the ticket's addresses failed ({err:#}); looking it up");
            attempt(EndpointAddr::new(peer.id))
                .await
                .context("Couldn't reach that host")
        }
        Err(err) => Err(err.context("Couldn't reach that host")),
    }
}

/// `port` is preferred if free: ideally the host's own, so its absolute URLs
/// work here too.
pub async fn serve(
    endpoint: Endpoint,
    peer: EndpointAddr,
    name: Option<String>,
    connection: Connection,
    port: Option<u16>,
) -> Result<Client> {
    let listeners = Listeners::bind(port).await?;
    let port = listeners.port;
    tracing::info!("Serving {} on http://localhost:{port}", peer.id);

    let dialer = Arc::new(Dialer {
        endpoint,
        peer,
        connection: Mutex::new(Some(connection)),
        dialing: tokio::sync::Mutex::new(()),
        last_failure: Mutex::new(None),
        stop: CancellationToken::new(),
    });

    let task = tokio::spawn({
        let dialer = dialer.clone();
        async move {
            loop {
                let accepted = tokio::select! {
                    accepted = listeners.accept() => accepted,
                    _ = dialer.stop.cancelled() => break,
                };
                let tcp = match accepted {
                    Ok(tcp) => tcp,
                    Err(err) => {
                        tracing::warn!("Error accepting a local connection: {err}");
                        continue;
                    }
                };
                let dialer = dialer.clone();
                tokio::spawn(async move {
                    if let Err(err) = dialer.forward(tcp).await {
                        tracing::warn!("Tunnel to {} failed: {err:#}", dialer.peer.id);
                    }
                });
            }
            tracing::info!("Stopped serving {}", dialer.peer.id);
        }
    });

    Ok(Client {
        dialer,
        name,
        port,
        task,
    })
}

/// Both loopbacks: browsers may resolve `localhost` to either, and something
/// else on the other one would answer instead of the host.
struct Listeners {
    v4: TcpListener,
    v6: Option<TcpListener>,
    port: u16,
}

impl Listeners {
    const ATTEMPTS: usize = 8;

    async fn bind(preferred: Option<u16>) -> Result<Self> {
        let preferred = match preferred {
            Some(port) if answers_locally(port).await => None,
            preferred => preferred,
        };
        if let Some(port) = preferred {
            match Self::bind_port(port).await {
                Ok(listeners) => return Ok(listeners),
                Err(err) => tracing::warn!("Port {port} is not available ({err}); using another"),
            }
        }
        for _ in 0..Self::ATTEMPTS {
            if let Ok(listeners) = Self::bind_port(0).await {
                return Ok(listeners);
            }
        }
        anyhow::bail!("Failed to open a local port")
    }

    /// Fails if IPv6 has the port taken; carries on if there's no IPv6.
    async fn bind_port(port: u16) -> io::Result<Self> {
        let v4 = TcpListener::bind((Ipv4Addr::LOCALHOST, port)).await?;
        let port = v4.local_addr()?.port();
        let v6 = match TcpListener::bind((Ipv6Addr::LOCALHOST, port)).await {
            Ok(v6) => Some(v6),
            Err(err) if err.kind() == io::ErrorKind::AddrInUse => return Err(err),
            Err(_) => None,
        };
        Ok(Self { v4, v6, port })
    }

    async fn accept(&self) -> io::Result<TcpStream> {
        let (tcp, _): (TcpStream, SocketAddr) = match &self.v6 {
            Some(v6) => tokio::select! {
                accepted = self.v4.accept() => accepted?,
                accepted = v6.accept() => accepted?,
            },
            None => self.v4.accept().await?,
        };
        Ok(tcp)
    }
}

/// Whether something here already serves `port`, such as this machine's own
/// server. On macOS and Windows our loopback bind can succeed beside a
/// wildcard listener and would quietly take its `localhost` traffic.
async fn answers_locally(port: u16) -> bool {
    let connects = |addr: SocketAddr| async move {
        tokio::time::timeout(Duration::from_millis(300), TcpStream::connect(addr))
            .await
            .is_ok_and(|result| result.is_ok())
    };
    let (v4, v6) = tokio::join!(
        connects(SocketAddr::from((Ipv4Addr::LOCALHOST, port))),
        connects(SocketAddr::from((Ipv6Addr::LOCALHOST, port))),
    );
    let answers = v4 || v6;
    if answers {
        tracing::warn!("Port {port} is already in use here; using another");
    }
    answers
}

struct Dialer {
    endpoint: Endpoint,
    peer: EndpointAddr,
    connection: Mutex<Option<Connection>>,
    /// So a burst of requests after a drop dials once.
    dialing: tokio::sync::Mutex<()>,
    last_failure: Mutex<Option<Instant>>,
    stop: CancellationToken,
}

impl Dialer {
    async fn connection(&self) -> Result<Connection> {
        if let Some(connection) = self.live() {
            return Ok(connection);
        }
        let _guard = self.dialing.lock().await;
        if let Some(connection) = self.live() {
            return Ok(connection);
        }
        let failed_recently = self
            .last_failure
            .lock()
            .expect("failure lock")
            .is_some_and(|at| at.elapsed() < RETRY_AFTER_FAILURE);
        if failed_recently {
            anyhow::bail!("Couldn't reach that host");
        }
        if self.stop.is_cancelled() {
            anyhow::bail!("Disconnected");
        }

        tracing::info!("Reconnecting to {}", self.peer.id);
        let connection = match dial(&self.endpoint, &self.peer).await {
            Ok(connection) => connection,
            Err(err) => {
                *self.last_failure.lock().expect("failure lock") = Some(Instant::now());
                return Err(err);
            }
        };
        *self.last_failure.lock().expect("failure lock") = None;

        // Under the lock `close` takes, so a connection made during a
        // disconnect is never kept.
        let mut slot = self.connection.lock().expect("connection lock");
        if self.stop.is_cancelled() {
            connection.close(0u32.into(), b"disconnected");
            anyhow::bail!("Disconnected");
        }
        *slot = Some(connection.clone());
        Ok(connection)
    }

    fn live(&self) -> Option<Connection> {
        self.connection
            .lock()
            .expect("connection lock")
            .as_ref()
            .filter(|c| c.close_reason().is_none())
            .cloned()
    }

    fn close(&self) {
        let mut slot = self.connection.lock().expect("connection lock");
        self.stop.cancel();
        if let Some(connection) = slot.take() {
            connection.close(0u32.into(), b"disconnected");
        }
    }

    async fn forward(&self, tcp: TcpStream) -> Result<()> {
        let connection = self.connection().await?;
        let (mut send, recv) = match connection.open_bi().await {
            Ok(stream) => stream,
            // Dropped since the check.
            Err(_) => self.connection().await?.open_bi().await?,
        };
        send.write_all(&HANDSHAKE).await?;
        let (read, write) = tcp.into_split();
        forward_bidi(read, write, recv, send).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bare_id_and_a_ticket_both_parse() {
        let secret = iroh::SecretKey::generate();
        let id = secret.public();

        let from_id = parse_peer(&id.to_string()).unwrap();
        assert_eq!(from_id.id, id);
        assert!(from_id.is_empty());

        let ticket = iroh_tickets::endpoint::EndpointTicket::new(EndpointAddr::new(id));
        assert_eq!(parse_peer(&ticket.to_string()).unwrap().id, id);
    }

    #[test]
    fn junk_is_refused() {
        assert!(parse_peer("not a peer").is_err());
    }

    #[tokio::test]
    async fn the_port_is_held_on_both_loopbacks() {
        let listeners = Listeners::bind(None).await.unwrap();
        let port = listeners.port;
        assert!(TcpListener::bind((Ipv4Addr::LOCALHOST, port))
            .await
            .is_err());
        if listeners.v6.is_some() {
            assert!(TcpListener::bind((Ipv6Addr::LOCALHOST, port))
                .await
                .is_err());
        }
    }

    #[tokio::test]
    async fn a_port_served_here_is_not_used() {
        let ours = std::net::TcpListener::bind((Ipv4Addr::UNSPECIFIED, 0)).unwrap();
        let taken = ours.local_addr().unwrap().port();
        let listeners = Listeners::bind(Some(taken)).await.unwrap();
        assert_ne!(listeners.port, taken);
    }

    #[tokio::test]
    async fn a_port_taken_on_ipv6_is_not_used() {
        // Something else holds a port on IPv6 only.
        let Ok(other) = TcpListener::bind((Ipv6Addr::LOCALHOST, 0)).await else {
            return; // No IPv6 here.
        };
        let taken = other.local_addr().unwrap().port();
        let listeners = Listeners::bind(Some(taken)).await.unwrap();
        assert_ne!(listeners.port, taken);
    }
}
