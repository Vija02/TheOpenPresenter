//! Finding hosts on the local network.
//!
//! mDNS only says an endpoint exists. Each one found is asked for its name and
//! server port over a small info protocol, and listed only if it answers, so
//! installs that aren't hosting never show up. `host_discovered` is an
//! upsert: it's sent again when a host's name or port changes. The name isn't put in mDNS user
//! data because iroh also publishes that to n0's public DNS.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use iroh::endpoint::{Connection, Endpoint};
use iroh::EndpointId;
use iroh_mdns_address_lookup::{DiscoveryEvent, MdnsAddressLookup};
use serde::{Deserialize, Serialize};
use tokio_stream::StreamExt;
use tokio_util::sync::CancellationToken;

use super::host::Resolver;

/// Shows up as `_theopenpresenter._udp.local`, so only Studios see each other.
pub const SERVICE_NAME: &str = "theopenpresenter";
pub const INFO_ALPN: &[u8] = b"top/info/0";
const INFO_REQUEST: &[u8; 4] = b"info";
pub const INFO_TIMEOUT: Duration = Duration::from_secs(5);
/// Peers found over mDNS are on the LAN and answer in milliseconds.
const PROBE_TIMEOUT: Duration = Duration::from_secs(3);
/// Peers that didn't answer (not hosting, or not yet) are asked again after this.
const RETRY_PROBE_AFTER: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HostInfo {
    pub name: String,
    /// The host's server port, so a joiner can serve it on the same one.
    pub port: Option<u16>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DiscoveredHost {
    pub id: String,
    pub name: String,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum Event {
    HostDiscovered { host: DiscoveredHost },
    HostExpired { id: String },
}

pub type EventSink = Arc<dyn Fn(Event) + Send + Sync>;

/// This machine's name, as other Studios will see it.
pub fn hostname() -> String {
    #[cfg(unix)]
    let name = {
        let mut buf = [0u8; 256];
        // Safety: the buffer outlives the call and its length is passed.
        let ok = unsafe { libc::gethostname(buf.as_mut_ptr().cast(), buf.len()) } == 0;
        let end = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
        ok.then(|| String::from_utf8_lossy(&buf[..end]).into_owned())
    };
    #[cfg(windows)]
    let name = std::env::var("COMPUTERNAME").ok();

    name.map(|n| n.trim_end_matches(".local").to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "Studio".to_string())
}

/// Answer one info request, as a host. Time-limited, so a peer can't hold
/// the connection open.
pub(super) async fn serve_info(
    connection: Connection,
    name: String,
    resolver: Arc<Resolver>,
) -> Result<()> {
    tokio::time::timeout(INFO_TIMEOUT * 2, answer_info(connection, name, resolver))
        .await
        .context("timed out")?
}

async fn answer_info(connection: Connection, name: String, resolver: Arc<Resolver>) -> Result<()> {
    let (mut send, mut recv) = connection.accept_bi().await?;
    let mut request = [0u8; INFO_REQUEST.len()];
    recv.read_exact(&mut request).await?;
    if &request != INFO_REQUEST {
        anyhow::bail!("Invalid info request");
    }
    let port = resolver.resolve().await.ok().map(|addr| addr.port());
    send.write_all(&serde_json::to_vec(&HostInfo { name, port })?)
        .await?;
    send.finish()?;
    // Dropping the connection now could lose the reply; let the asker close.
    let _ = tokio::time::timeout(INFO_TIMEOUT, connection.closed()).await;
    Ok(())
}

/// Ask a host for its name and server port.
pub async fn query_info(
    endpoint: &Endpoint,
    peer: impl Into<iroh::EndpointAddr>,
    timeout: Duration,
) -> Result<HostInfo> {
    let ask = async {
        let connection = endpoint.connect(peer, INFO_ALPN).await?;
        let (mut send, mut recv) = connection.open_bi().await?;
        send.write_all(INFO_REQUEST).await?;
        send.finish()?;
        let reply = recv.read_to_end(4096).await?;
        connection.close(0u32.into(), b"thanks");
        anyhow::Ok(serde_json::from_slice::<HostInfo>(&reply)?)
    };
    tokio::time::timeout(timeout, ask)
        .await
        .context("timed out")?
}

/// Peers mDNS currently sees, kept by the endpoint from the moment each mDNS
/// service starts. A new subscriber only hears about changes, so a browser
/// started later reads this instead.
pub(super) type Peers = Arc<Mutex<PeerSet>>;

#[derive(Default)]
pub(super) struct PeerSet {
    seen: HashSet<EndpointId>,
    /// Everyone seen lately, and when. mDNS doesn't tell subscribers about a
    /// peer while something is connecting to it, and then treats its later
    /// announcements as repeats, so a returning host can stay out of `seen`.
    known: HashMap<EndpointId, Instant>,
    /// When our own mDNS service was last replaced, which empties `seen`
    /// until the new one finds everyone again.
    swapped: Option<Instant>,
    /// Bumped on each swap, so the old service's last events are ignored.
    generation: u64,
}

impl PeerSet {
    /// Start over with a new mDNS service; returns its generation.
    pub(super) fn swap(&mut self) -> u64 {
        self.seen.clear();
        self.swapped = Some(Instant::now());
        self.generation += 1;
        self.generation
    }

    /// A peer to keep asking, such as the host we've joined.
    pub(super) fn remember(&mut self, id: EndpointId) {
        self.known.insert(id, Instant::now());
    }
}

/// How long a peer no longer seen is still asked about.
const KNOWN_FOR: Duration = Duration::from_secs(10 * 60);

/// After our own swap, a host dropping out of `seen` may still be there.
const SWAP_GRACE: Duration = Duration::from_secs(10);

/// Keep `peers` in step with one mDNS service, until it's swapped out.
pub(super) fn watch_peers(mdns: &MdnsAddressLookup, peers: Peers, generation: u64) {
    let mdns = mdns.clone();
    tokio::spawn(async move {
        let mut stream = mdns.subscribe().await;
        // Holding a clone would keep a swapped-out service alive.
        drop(mdns);
        while let Some(event) = stream.next().await {
            let mut peers = peers.lock().expect("peers lock");
            if peers.generation != generation {
                return;
            }
            match event {
                DiscoveryEvent::Discovered { endpoint_info, .. } => {
                    peers.seen.insert(endpoint_info.endpoint_id);
                    peers.remember(endpoint_info.endpoint_id);
                }
                DiscoveryEvent::Expired { endpoint_id } => {
                    peers.seen.remove(&endpoint_id);
                    peers.remember(endpoint_id);
                }
                _ => {}
            }
        }
    });
}

/// How often the browser compares against `Peers`.
const TICK: Duration = Duration::from_secs(2);
/// Listed hosts are asked again this often, for a changed name or port.
const REFRESH: Duration = Duration::from_secs(30);
/// Sooner for listed hosts mDNS doesn't currently see. mDNS can miss a host
/// that stops and starts quickly, so leaving isn't always seen.
const REFRESH_UNSEEN: Duration = Duration::from_secs(10);

/// Lists hosts found on the local network while it runs. All state lives in
/// one task; probes report back to it, so nothing is emitted after `stop`.
pub(super) struct Browser {
    hosts: Arc<Mutex<HashMap<EndpointId, DiscoveredHost>>>,
    stop: CancellationToken,
}

impl Browser {
    pub(super) fn start(endpoint: Endpoint, peers: Peers, events: EventSink) -> Self {
        let browser = Self {
            hosts: Arc::default(),
            stop: CancellationToken::new(),
        };
        let mut state = BrowseState {
            endpoint,
            peers,
            hosts: browser.hosts.clone(),
            listed: HashMap::new(),
            unanswered: HashMap::new(),
            seen: HashSet::new(),
            probing: HashSet::new(),
            events,
        };
        let stop = browser.stop.clone();
        tokio::spawn(async move {
            let (results_tx, mut results) = tokio::sync::mpsc::unbounded_channel();
            let mut tick = tokio::time::interval(TICK);
            loop {
                tokio::select! {
                    _ = tick.tick() => state.tick(&results_tx),
                    Some((id, result)) = results.recv() => state.answered(id, result),
                    _ = stop.cancelled() => break,
                }
            }
        });
        browser
    }

    pub(super) fn hosts(&self) -> Vec<DiscoveredHost> {
        let mut hosts: Vec<_> = self
            .hosts
            .lock()
            .expect("hosts lock")
            .values()
            .cloned()
            .collect();
        hosts.sort_by(|a, b| a.name.cmp(&b.name));
        hosts
    }

    pub(super) fn stop(&self) {
        self.stop.cancel();
    }
}

type ProbeResult = (EndpointId, Result<HostInfo>);

struct Listed {
    host: DiscoveredHost,
    checked: Instant,
    /// Whether mDNS saw it at the last tick, to spot it leaving.
    seen: bool,
    /// One missed refresh is forgiven while mDNS still sees it.
    missed: bool,
}

struct BrowseState {
    endpoint: Endpoint,
    peers: Peers,
    hosts: Arc<Mutex<HashMap<EndpointId, DiscoveredHost>>>,
    listed: HashMap<EndpointId, Listed>,
    unanswered: HashMap<EndpointId, Instant>,
    probing: HashSet<EndpointId>,
    /// Peers seen at the last tick, to spot arrivals.
    seen: HashSet<EndpointId>,
    events: EventSink,
}

impl BrowseState {
    fn tick(&mut self, results: &tokio::sync::mpsc::UnboundedSender<ProbeResult>) {
        let (seen, known, swapped_recently) = {
            let mut peers = self.peers.lock().expect("peers lock");
            peers.known.retain(|_, at| at.elapsed() < KNOWN_FOR);
            let recent = peers.swapped.is_some_and(|at| at.elapsed() < SWAP_GRACE);
            let known: Vec<_> = peers.known.keys().copied().collect();
            (peers.seen.clone(), known, recent)
        };
        let mut to_probe = Vec::new();
        let mut gone = Vec::new();

        // A peer that (re)appears may have just started hosting: ask now,
        // even if it didn't answer recently.
        for id in seen.difference(&self.seen) {
            self.unanswered.remove(id);
        }
        self.seen = seen.clone();

        for &id in seen.iter().chain(&known) {
            if id == self.endpoint.id() || self.listed.contains_key(&id) {
                continue;
            }
            let waiting = self
                .unanswered
                .get(&id)
                .is_some_and(|at| at.elapsed() < RETRY_PROBE_AFTER);
            if !waiting && !to_probe.contains(&id) {
                to_probe.push(id);
            }
        }

        for (&id, listed) in &mut self.listed {
            let now_seen = seen.contains(&id);
            let left = listed.seen && !now_seen;
            listed.seen = now_seen;
            let due = if now_seen { REFRESH } else { REFRESH_UNSEEN };
            if left && !swapped_recently {
                gone.push(id);
            } else if left || listed.missed || listed.checked.elapsed() >= due {
                // Just after our swap, ask before dropping it.
                to_probe.push(id);
            }
        }
        for id in gone {
            self.lose(id);
        }

        for id in to_probe {
            if !self.probing.insert(id) {
                continue;
            }
            let endpoint = self.endpoint.clone();
            let results = results.clone();
            tokio::spawn(async move {
                let result = query_info(&endpoint, id, PROBE_TIMEOUT).await;
                let _ = results.send((id, result));
            });
        }
    }

    fn answered(&mut self, id: EndpointId, result: Result<HostInfo>) {
        self.probing.remove(&id);
        match result {
            Ok(info) => {
                self.unanswered.remove(&id);
                let host = DiscoveredHost {
                    id: id.to_string(),
                    name: info.name,
                    port: info.port,
                };
                let changed = self.listed.get(&id).is_none_or(|l| l.host != host);
                let seen = self.peers.lock().expect("peers lock").seen.contains(&id);
                self.listed.insert(
                    id,
                    Listed {
                        host: host.clone(),
                        checked: Instant::now(),
                        seen,
                        missed: false,
                    },
                );
                if changed {
                    tracing::info!("Found {} ({})", host.name, host.id);
                    self.hosts
                        .lock()
                        .expect("hosts lock")
                        .insert(id, host.clone());
                    (self.events)(Event::HostDiscovered { host });
                }
            }
            Err(err) => {
                tracing::debug!("{id} didn't answer: {err:#}");
                if let Some(listed) = self.listed.get_mut(&id) {
                    if listed.seen && !listed.missed {
                        // Ask again next tick before dropping it.
                        listed.missed = true;
                        return;
                    }
                }
                self.unanswered.insert(id, Instant::now());
                self.lose(id);
            }
        }
    }

    fn lose(&mut self, id: EndpointId) {
        if self.listed.remove(&id).is_some() {
            tracing::info!("Lost {id}");
            self.hosts.lock().expect("hosts lock").remove(&id);
            (self.events)(Event::HostExpired { id: id.to_string() });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn events_are_tagged_like_the_managers() {
        let event = Event::HostExpired { id: "abc".into() };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["event"], "host_expired");
        assert_eq!(json["id"], "abc");
    }

    #[tokio::test]
    async fn a_host_answers_with_its_name_and_port() {
        let bind = |alpns: Vec<Vec<u8>>| {
            Endpoint::builder(iroh::endpoint::presets::Minimal)
                .relay_mode(iroh::RelayMode::Disabled)
                .alpns(alpns)
                .bind()
        };
        let host = bind(vec![INFO_ALPN.to_vec()]).await.unwrap();
        let joiner = bind(vec![]).await.unwrap();

        let resolver = Arc::new(Resolver::new(super::super::Target::Port(6678)));
        let accept = host.clone();
        tokio::spawn(async move {
            let connection = accept.accept().await.unwrap().await.unwrap();
            serve_info(connection, "Hall".into(), resolver)
                .await
                .unwrap();
        });

        let info = query_info(&joiner, host.addr(), INFO_TIMEOUT)
            .await
            .unwrap();
        assert_eq!(
            info,
            HostInfo {
                name: "Hall".into(),
                port: Some(6678)
            }
        );
    }

    #[test]
    fn the_hostname_is_never_empty() {
        assert!(!hostname().is_empty());
        assert!(!hostname().ends_with(".local"));
    }
}
