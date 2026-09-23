//! `top-runtime-keygen` - generate a release signing keypair.
//!
//! The private key signs manifests in CI; the public key is compiled into the
//! manager (or supplied as `TOP_RUNTIME_PUBKEY`). Losing the private key
//! means clients stop accepting new releases until a shell update ships a new
//! public key, so it belongs in a secrets store, not a repo.

use anyhow::Result;
use base64::Engine;
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;

fn main() -> Result<()> {
    let key = SigningKey::generate(&mut OsRng);
    let encode = |bytes: &[u8]| base64::engine::general_purpose::STANDARD.encode(bytes);

    let private = encode(&key.to_bytes());
    let public = encode(&key.verifying_key().to_bytes());

    match std::env::args().nth(1).as_deref() {
        // Print only the private key so it can be piped straight into a file
        // or a secrets store without a stray newline of prose.
        Some("--private") => println!("{private}"),
        Some("--public") => println!("{public}"),
        _ => {
            println!("private (keep secret, store as RUNTIME_SIGNING_KEY):");
            println!("{private}");
            println!();
            println!("public (set as TOP_RUNTIME_PUBKEY / DEFAULT_PUBKEY_B64):");
            println!("{public}");
        }
    }

    Ok(())
}
