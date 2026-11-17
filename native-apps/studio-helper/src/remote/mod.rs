mod client;
mod discovery;
mod forward;
mod host;

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{Context, Result};
use iroh::address_lookup::{AddressLookupBuilder, DnsAddressLookup, PkarrPublisher, PkarrResolver};
use iroh::endpoint::{Connection, Endpoint};
use iroh::SecretKey;
use iroh_mdns_address_lookup::MdnsAddressLookup;
use iroh_tickets::endpoint::EndpointTicket;
use tokio_util::sync::CancellationToken;

pub use client::{parse_peer, ClientStatus};
pub use discovery::{hostname, DiscoveredHost, Event, EventSink, HostInfo};
pub use forward::forward_bidi;

/// Dumbpipe's ALPN and handshake, so the `dumbpipe` CLI can talk to us directly.
pub const ALPN: &[u8] = b"DUMBPIPEV0";
pub const HANDSHAKE: [u8; 5] = *b"hello";

/// How long hosting waits for a relay, so its ticket includes one. Without a
/// relay we still work on the local network, so don't wait forever.
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
    name: String,
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
    /// The current mDNS service, advertising only while hosting.
    mdns: Arc<Mutex<Option<MdnsAddressLookup>>>,
    peers: discovery::Peers,
}

impl Node {
    async fn bind(data_dir: &Path) -> Result<Self> {
        let secret = get_or_create_secret(data_dir)?;

        // n0's relays and DNS lookup make a bare endpoint ID reachable from
        // other networks. Lookups are set up in `set_lookups`.
        let endpoint = Endpoint::builder(iroh::endpoint::presets::N0)
            .clear_address_lookup()
            .secret_key(secret)
            .alpns(vec![ALPN.to_vec(), discovery::INFO_ALPN.to_vec()])
            .bind()
            .await
            .context("Failed to create the iroh endpoint")?;
        let node = Self {
            endpoint,
            hosting: Arc::default(),
            mdns: Arc::default(),
            peers: Arc::default(),
        };
        node.set_lookups(false);
        let endpoint = node.endpoint.clone();
        tracing::info!("Endpoint id: {}", endpoint.id());

        let accept_endpoint = endpoint.clone();
        let accept_hosting = node.hosting.clone();
        tokio::spawn(async move {
            while let Some(incoming) = accept_endpoint.accept().await {
                let hosting = accept_hosting.lock().expect("hosting lock").clone();
                let Some(hosting) = hosting else {
                    // Accept and close rather than refuse: a refusal isn't
                    // seen quickly, so a browser asking would wait it out.
                    if let Ok(accepting) = incoming.accept() {
                        tokio::spawn(async move {
                            if let Ok(connection) = accepting.await {
                                connection.close(2u32.into(), b"not hosting");
                            }
                        });
                    }
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
                    let result = match accepting.await {
                        Ok(connection) => serve(connection, &hosting).await,
                        Err(err) => Err(err.into()),
                    };
                    if let Err(err) = result {
                        tracing::warn!("Incoming connection failed: {err:#}");
                    }
                });
            }
            tracing::info!("Endpoint closed, stopping the accept loop");
        });

        Ok(node)
    }

    /// Replace the address lookups: iroh can't remove one service, and
    /// whether mDNS advertises is fixed when it's built. Must run inside the
    /// tokio runtime.
    fn set_lookups(&self, advertise: bool) {
        let Ok(lookups) = self.endpoint.address_lookup() else {
            return;
        };
        let mut mdns = self.mdns.lock().expect("mdns lock");
        lookups.clear();

        let endpoint = &self.endpoint;
        let n0 = [
            PkarrPublisher::n0_dns()
                .into_address_lookup(endpoint)
                .map(|l| lookups.add(l)),
            PkarrResolver::n0_dns()
                .into_address_lookup(endpoint)
                .map(|l| lookups.add(l)),
            DnsAddressLookup::n0_dns()
                .into_address_lookup(endpoint)
                .map(|l| lookups.add(l)),
        ];
        for result in n0 {
            if let Err(err) = result {
                tracing::warn!("Address lookup unavailable: {err}");
            }
        }

        *mdns = match MdnsAddressLookup::builder()
            .service_name(discovery::SERVICE_NAME)
            .advertise(advertise)
            .build(endpoint.id())
        {
            Ok(service) => {
                lookups.add(service.clone());
                // The new service finds everyone again; a browser re-asks any
                // listed host that drops out meanwhile.
                let generation = self.peers.lock().expect("peers lock").swap();
                discovery::watch_peers(&service, self.peers.clone(), generation);
                Some(service)
            }
            Err(err) => {
                tracing::warn!("Local network discovery unavailable: {err}");
                None
            }
        };
    }

    fn hosting(&self) -> Option<Arc<Hosting>> {
        self.hosting.lock().expect("hosting lock").clone()
    }

    fn host(&self, target: Target, name: String) {
        let hosting = Arc::new(Hosting {
            name,
            resolver: Arc::new(host::Resolver::new(target)),
            stop: CancellationToken::new(),
            ticket: EndpointTicket::new(self.endpoint.addr()).to_string(),
        });
        *self.hosting.lock().expect("hosting lock") = Some(hosting);
        // Only now: a joiner that hears us must not be refused.
        self.set_lookups(true);
    }

    /// `closing`: the endpoint is about to close, so don't rebuild lookups.
    fn stop_hosting(&self, closing: bool) {
        if let Some(hosting) = self.hosting.lock().expect("hosting lock").take() {
            hosting.stop.cancel();
            if !closing {
                self.set_lookups(false);
            }
        }
    }
}

async fn serve(connection: Connection, hosting: &Hosting) -> Result<()> {
    if connection.alpn() == discovery::INFO_ALPN {
        discovery::serve_info(connection, hosting.name.clone(), hosting.resolver.clone()).await
    } else {
        host::handle_connection(connection, hosting.resolver.clone(), hosting.stop.clone()).await
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
    browser: Option<discovery::Browser>,
    events: EventSink,
}

impl Remote {
    pub fn new(events: EventSink) -> Result<Self> {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .context("Failed to start the async runtime for remote access")?;
        Ok(Self {
            runtime: Arc::new(runtime),
            node: None,
            client: None,
            browser: None,
            events,
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

    pub fn start(
        &mut self,
        target: Target,
        name: String,
        data_dir: PathBuf,
    ) -> Result<RemoteStatus> {
        let runtime = self.runtime.clone();
        let node = self.node(&data_dir)?;
        if node.hosting().is_none() {
            // Not when joining or browsing: those work on a LAN with no
            // internet, where this would only add a wait.
            let online = node.endpoint.online();
            let waited =
                runtime.block_on(async { tokio::time::timeout(ONLINE_TIMEOUT, online).await });
            if waited.is_err() {
                tracing::warn!("No home relay within {ONLINE_TIMEOUT:?}; continuing");
            }
            let _guard = runtime.enter();
            node.host(target, name);
            tracing::info!("Hosting");
        }
        Ok(self.status())
    }

    pub fn stop(&mut self) {
        let closing = self.client.is_none() && self.browser.is_none();
        if let Some(node) = &self.node {
            let _guard = self.runtime.enter();
            node.stop_hosting(closing);
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
        // Ask for its name and server port at the same time: the port makes
        // its absolute URLs work here.
        let (dialed, info) = self.runtime.block_on(async {
            tokio::join!(
                client::dial(&endpoint, &peer),
                discovery::query_info(&endpoint, peer.clone(), discovery::INFO_TIMEOUT),
            )
        });
        let connection = match dialed {
            Ok(connection) => connection,
            Err(err) => {
                self.close_if_idle();
                return Err(err);
            }
        };
        // A stale ticket can fail here even though the dial recovered; by
        // now the endpoint knows a working path to the bare ID.
        let info = match info {
            Ok(info) => Some(info),
            Err(_) if !peer.is_empty() => self
                .runtime
                .block_on(discovery::query_info(
                    &endpoint,
                    peer.id,
                    discovery::INFO_TIMEOUT,
                ))
                .ok(),
            Err(_) => None,
        };
        if let Some(node) = &self.node {
            node.peers.lock().expect("peers lock").remember(peer.id);
        }
        let port = port.or(info.as_ref().and_then(|info| info.port));
        let name = info.map(|info| info.name);

        // Close the old one first so the new one can bind the same port.
        self.disconnect_client();
        let served = self.runtime.block_on(client::serve(
            endpoint,
            peer,
            name,
            connection.clone(),
            port,
            self.events.clone(),
        ));
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

    /// Start listing hosts on the local network; returns those known so far.
    pub fn discover_start(&mut self, data_dir: PathBuf) -> Result<Vec<DiscoveredHost>> {
        if self.browser.is_none() {
            let node = self.node(&data_dir)?;
            let (endpoint, peers) = (node.endpoint.clone(), node.peers.clone());
            let _guard = self.runtime.enter();
            self.browser = Some(discovery::Browser::start(
                endpoint,
                peers,
                self.events.clone(),
            ));
        }
        Ok(self.discovered())
    }

    pub fn discover_stop(&mut self) {
        if let Some(browser) = self.browser.take() {
            browser.stop();
        }
        self.close_if_idle();
    }

    pub fn discovered(&self) -> Vec<DiscoveredHost> {
        self.browser
            .as_ref()
            .map(discovery::Browser::hosts)
            .unwrap_or_default()
    }

    fn close_if_idle(&mut self) {
        let hosting = self.node.as_ref().and_then(Node::hosting).is_some();
        if hosting || self.client.is_some() || self.browser.is_some() {
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
