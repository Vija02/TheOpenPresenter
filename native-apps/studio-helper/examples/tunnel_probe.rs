// Connect to the bridge over iroh and speak HTTP through it, proving the
// tunnel carries real traffic rather than merely starting.
use std::env;

use anyhow::{Context, Result};
use iroh::{endpoint::Endpoint, SecretKey};
use iroh_tickets::endpoint::EndpointTicket;
// read()/write_all() are inherent on quinn's Recv/SendStream; no tokio
// extension traits needed.

const ALPN: &[u8] = b"DUMBPIPEV0";
const HANDSHAKE: [u8; 5] = *b"hello";

#[tokio::main]
async fn main() -> Result<()> {
    let ticket = env::args().nth(1).context("usage: tunnel_probe <ticket>")?;
    let ticket: EndpointTicket = ticket.parse().context("Invalid ticket")?;

    let endpoint = Endpoint::builder(iroh::endpoint::presets::N0)
        .secret_key(SecretKey::generate())
        .bind()
        .await?;

    let addr: iroh::EndpointAddr = ticket.into();
    let connection = endpoint.connect(addr, ALPN).await.context("connect")?;
    let (mut send, mut recv) = connection.open_bi().await.context("open_bi")?;

    send.write_all(&HANDSHAKE).await?;
    send.write_all(b"GET /o HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
        .await?;

    let mut buf = vec![0u8; 512];
    let n = recv.read(&mut buf).await?.unwrap_or(0);
    let head = String::from_utf8_lossy(&buf[..n]);
    println!("{}", head.lines().next().unwrap_or("(no response)"));

    Ok(())
}
