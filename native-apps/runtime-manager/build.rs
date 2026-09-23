use std::path::Path;

/// Bakes the release signing key into the binary.
///
/// The manager must know its trusted key without being told at runtime: an
/// environment variable the user could set is not a trust anchor, it is a
/// bypass. CI sets `TOP_RUNTIME_PUBKEY` when building the shipped binary.
///
/// For development there is no key and no signed release to fetch, so the
/// build falls back to a key generated once into `dev-pubkey.txt`, which the
/// dev tooling also uses to sign local test releases.
fn main() {
    println!("cargo:rerun-if-env-changed=TOP_RUNTIME_PUBKEY");
    println!("cargo:rerun-if-changed=dev-pubkey.txt");

    let key = std::env::var("TOP_RUNTIME_PUBKEY")
        .ok()
        .filter(|k| !k.trim().is_empty())
        .or_else(read_dev_key)
        .unwrap_or_default();

    println!("cargo:rustc-env=TOP_RUNTIME_BAKED_PUBKEY={}", key.trim());
}

fn read_dev_key() -> Option<String> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("dev-pubkey.txt");
    std::fs::read_to_string(path)
        .ok()
        .filter(|k| !k.trim().is_empty())
}
