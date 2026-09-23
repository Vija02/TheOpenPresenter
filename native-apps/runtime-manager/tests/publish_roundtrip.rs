//! Publish with the real publisher, install with the real manager.
//!
//! The unit tests build their own CDN fixtures, which means they would still
//! pass if the publisher wrote a layout the manager cannot read. This drives
//! both binaries against each other so that class of mismatch cannot hide.

use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Command, Stdio};

use top_runtime_manager::runtime::fetch;
use top_runtime_manager::storage::platform::Platform;

/// The platform these fixtures publish for: always the one running the
/// test, since a test installs what it just published.
fn plat() -> Platform {
    Platform::current()
}

fn keygen() -> (String, String) {
    let out = Command::new(env!("CARGO_BIN_EXE_top-runtime-keygen"))
        .arg("--private")
        .output()
        .expect("keygen failed to run");
    let private = String::from_utf8(out.stdout).unwrap().trim().to_string();

    let out = Command::new(env!("CARGO_BIN_EXE_top-runtime-keygen"))
        .arg("--public")
        .output()
        .unwrap();
    let public = String::from_utf8(out.stdout).unwrap().trim().to_string();

    // Each invocation generates a fresh key, so derive the public half from
    // the private one we actually kept rather than pairing two runs.
    let _ = public;
    let bytes = {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD
            .decode(&private)
            .unwrap()
    };
    let array: [u8; 32] = bytes.try_into().unwrap();
    let key = ed25519_dalek::SigningKey::from_bytes(&array);
    let public = {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(key.verifying_key().to_bytes())
    };

    (private, public)
}

fn publish(runtime: &Path, cdn: &Path, key_file: &Path, version: &str, schema: &str) {
    let status = Command::new(env!("CARGO_BIN_EXE_top-runtime-publish"))
        .args(["--runtime", runtime.to_str().unwrap()])
        .args(["--version", version])
        .args(["--schema", schema])
        .args(["--entry", "run_server.mjs"])
        .args(["--out", cdn.to_str().unwrap()])
        .args(["--key", key_file.to_str().unwrap()])
        .status()
        .expect("publisher failed to run");
    assert!(status.success(), "publishing {version} failed");
}

fn ensure_via_manager(root: &Path, cdn: &Path, pubkey: &str) -> serde_json::Value {
    let mut child = Command::new(env!("CARGO_BIN_EXE_top-runtime-manager"))
        .args(["--root", root.to_str().unwrap()])
        .args(["--source", cdn.to_str().unwrap()])
        .env("TOP_RUNTIME_PUBKEY", pubkey)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();

    let mut stdin = child.stdin.take().unwrap();
    let mut stdout = BufReader::new(child.stdout.take().unwrap());

    writeln!(stdin, r#"{{"id":1,"cmd":"ensure","channel":"stable"}}"#).unwrap();
    stdin.flush().unwrap();

    let response = loop {
        let mut line = String::new();
        assert_ne!(stdout.read_line(&mut line).unwrap(), 0, "manager died");
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(line.trim()) {
            if value.get("id").and_then(|v| v.as_u64()) == Some(1) {
                break value;
            }
        }
    };

    let _ = writeln!(stdin, r#"{{"cmd":"shutdown"}}"#);
    let _ = child.wait();
    response
}

#[test]
fn a_published_release_installs_byte_for_byte() {
    let source = tempfile::tempdir().unwrap();
    let cdn = tempfile::tempdir().unwrap();
    let root = tempfile::tempdir().unwrap();
    let keys = tempfile::tempdir().unwrap();

    // A runtime tree shaped like the real one: an entrypoint, a nested
    // dependency, and a binary.
    std::fs::write(source.path().join("run_server.mjs"), b"// server entry\n").unwrap();
    std::fs::create_dir_all(source.path().join("node_modules/dep/lib")).unwrap();
    std::fs::write(
        source.path().join("node_modules/dep/lib/index.js"),
        b"module.exports = 1;\n",
    )
    .unwrap();
    std::fs::write(source.path().join("node"), b"\x7fELF fake binary").unwrap();

    let (private, public) = keygen();
    let key_file = keys.path().join("release.key");
    std::fs::write(&key_file, &private).unwrap();

    publish(source.path(), cdn.path(), &key_file, "1.0.0", "1");
    let response = ensure_via_manager(root.path(), cdn.path(), &public);

    assert_eq!(response["ok"], true, "install failed: {response}");
    assert_eq!(response["result"]["version"], "1.0.0");

    let installed = root.path().join("versions/1.0.0");
    for relative in ["run_server.mjs", "node_modules/dep/lib/index.js", "node"] {
        assert_eq!(
            std::fs::read(installed.join(relative)).unwrap(),
            std::fs::read(source.path().join(relative)).unwrap(),
            "{relative} did not survive the publish/install round trip"
        );
    }
}

#[test]
fn a_delta_pack_carries_only_the_changed_files() {
    let source = tempfile::tempdir().unwrap();
    let cdn = tempfile::tempdir().unwrap();
    let keys = tempfile::tempdir().unwrap();

    // 2MB of incompressible "unchanging dependency" plus a small app file.
    // Compressible filler would make both packs a few hundred bytes and the
    // comparison meaningless.
    let bulk: Vec<u8> = (0..2 * 1024 * 1024u32)
        .map(|i| {
            let x = i.wrapping_mul(2654435761);
            (x ^ (x >> 13)) as u8
        })
        .collect();
    std::fs::write(source.path().join("run_server.mjs"), b"// v1\n").unwrap();
    std::fs::write(source.path().join("big.bin"), &bulk).unwrap();

    let (private, _) = keygen();
    let key_file = keys.path().join("release.key");
    std::fs::write(&key_file, &private).unwrap();

    publish(source.path(), cdn.path(), &key_file, "1.0.0", "1");

    // Only the small file changes.
    std::fs::write(source.path().join("run_server.mjs"), b"// v2\n").unwrap();
    let status = Command::new(env!("CARGO_BIN_EXE_top-runtime-publish"))
        .args(["--runtime", source.path().to_str().unwrap()])
        .args(["--version", "1.1.0"])
        .args(["--schema", "1"])
        .args(["--entry", "run_server.mjs"])
        .args(["--out", cdn.path().to_str().unwrap()])
        .args(["--key", key_file.to_str().unwrap()])
        .args(["--previous", "1.0.0"])
        .status()
        .unwrap();
    assert!(status.success());

    let full = std::fs::metadata(cdn.path().join(fetch::full_pack_key(&plat(), "1.1.0")))
        .unwrap()
        .len();
    let delta = std::fs::metadata(cdn.path().join(fetch::delta_pack_key(
        &plat(),
        "1.0.0",
        "1.1.0",
    )))
    .unwrap()
    .len();

    assert!(
        delta * 10 < full,
        "a delta carrying one small file should be far smaller than the full \
         pack, but delta={delta} full={full}"
    );
}

#[cfg(unix)]
#[test]
fn a_soname_symlink_chain_survives_publish_and_install() {
    // This is the bug that made PostgreSQL fail to start with exit 127.
    // Shared libraries are looked up by their soname (libicuuc.so.60),
    // which is a symlink to the real file (libicuuc.so.60.2). Collapsing
    // those links into copies, or dropping them, leaves the name the
    // dynamic linker actually asks for missing.
    let source = tempfile::tempdir().unwrap();
    let cdn = tempfile::tempdir().unwrap();
    let root = tempfile::tempdir().unwrap();
    let keys = tempfile::tempdir().unwrap();

    std::fs::write(source.path().join("run_server.mjs"), b"// entry\n").unwrap();

    let lib = source.path().join("lib");
    std::fs::create_dir_all(&lib).unwrap();
    std::fs::write(lib.join("libicuuc.so.60.2"), b"\x7fELF real library").unwrap();
    std::os::unix::fs::symlink("libicuuc.so.60.2", lib.join("libicuuc.so.60")).unwrap();
    std::os::unix::fs::symlink("libicuuc.so.60", lib.join("libicuuc.so")).unwrap();

    let (private, public) = keygen();
    let key_file = keys.path().join("release.key");
    std::fs::write(&key_file, &private).unwrap();

    publish(source.path(), cdn.path(), &key_file, "1.0.0", "1");
    let response = ensure_via_manager(root.path(), cdn.path(), &public);
    assert_eq!(response["ok"], true, "install failed: {response}");

    let installed = root.path().join("versions/1.0.0/lib");

    // Every name in the chain must exist, and the two links must still be
    // links rather than copies.
    for name in ["libicuuc.so", "libicuuc.so.60", "libicuuc.so.60.2"] {
        assert!(
            std::fs::symlink_metadata(installed.join(name)).is_ok(),
            "{name} is missing from the installed runtime"
        );
    }
    for name in ["libicuuc.so", "libicuuc.so.60"] {
        assert!(
            std::fs::symlink_metadata(installed.join(name))
                .unwrap()
                .file_type()
                .is_symlink(),
            "{name} was flattened into a copy"
        );
    }

    // And following the chain must reach the real content.
    assert_eq!(
        std::fs::read(installed.join("libicuuc.so")).unwrap(),
        b"\x7fELF real library"
    );
}

#[test]
fn publishing_refuses_a_runtime_without_its_entrypoint() {
    let source = tempfile::tempdir().unwrap();
    let cdn = tempfile::tempdir().unwrap();
    let keys = tempfile::tempdir().unwrap();
    std::fs::write(source.path().join("something-else.js"), b"x").unwrap();

    let (private, _) = keygen();
    let key_file = keys.path().join("release.key");
    std::fs::write(&key_file, &private).unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_top-runtime-publish"))
        .args(["--runtime", source.path().to_str().unwrap()])
        .args(["--version", "1.0.0"])
        .args(["--entry", "run_server.mjs"])
        .args(["--out", cdn.path().to_str().unwrap()])
        .args(["--key", key_file.to_str().unwrap()])
        .output()
        .unwrap();

    assert!(
        !output.status.success(),
        "publishing a runtime that cannot start must fail"
    );
    assert!(
        String::from_utf8_lossy(&output.stderr).contains("Entrypoint"),
        "unexpected error output"
    );
}
