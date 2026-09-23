//! End-to-end test of the real binary over its real protocol.
//!
//! Everything below drives `top-runtime-manager` as a subprocess exactly the
//! way the Electron shell does: publish a signed release into a directory,
//! point the manager at it, and speak line-delimited JSON on its stdin.

use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};

use base64::Engine;
use ed25519_dalek::{Signer, SigningKey};
use serde_json::Value;

use top_runtime_manager::runtime::fetch;
use top_runtime_manager::storage::platform::Platform;

/// The platform these fixtures publish for: always the one running the
/// test, since a test installs what it just published.
fn plat() -> Platform {
    Platform::current()
}

fn hash(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

/// Publishes a signed release into a CDN-shaped directory.
fn publish(
    cdn: &Path,
    key: &SigningKey,
    version: &str,
    schema_version: u32,
    entry: &str,
    files: &[(&str, &[u8])],
) {
    let entries: Vec<Value> = files
        .iter()
        .map(|(path, content)| {
            serde_json::json!({
                "path": path,
                "sha256": hash(content),
                "size": content.len(),
                "mode": "0644",
            })
        })
        .collect();

    let manifest = serde_json::json!({
        "version": version,
        "schema_version": schema_version,
        "entry": entry,
        "files": entries,
    });
    let manifest_json = serde_json::to_string(&manifest).unwrap();
    let signature = base64::engine::general_purpose::STANDARD
        .encode(key.sign(manifest_json.as_bytes()).to_bytes());

    let manifest_path = cdn.join(fetch::manifest_key(&plat(), version));
    std::fs::create_dir_all(manifest_path.parent().unwrap()).unwrap();
    std::fs::write(
        &manifest_path,
        serde_json::to_vec(&serde_json::json!({
            "manifest": manifest_json,
            "signature": signature,
        }))
        .unwrap(),
    )
    .unwrap();

    for (_, content) in files {
        let h = hash(content);
        let blob = cdn.join(format!("blobs/{}/{}", &h[..2], h));
        std::fs::create_dir_all(blob.parent().unwrap()).unwrap();
        std::fs::write(&blob, zstd::stream::encode_all(*content, 3).unwrap()).unwrap();
    }

    let channel = cdn.join(fetch::channel_key("stable", &plat()));
    std::fs::create_dir_all(channel.parent().unwrap()).unwrap();
    std::fs::write(
        &channel,
        serde_json::to_vec(&serde_json::json!({
            "channel": "stable",
            "version": version,
        }))
        .unwrap(),
    )
    .unwrap();
}

/// Publish a version that ships packs rather than loose blobs, the way a
/// real release does.
///
/// `previous` adds a delta pack containing only what that hop introduces.
/// Also maintains `versions.json`, which is how a client discovers the
/// versions it can chain deltas through.
fn publish_with_previous(
    cdn: &Path,
    key: &SigningKey,
    version: &str,
    schema_version: u32,
    entry: &str,
    files: &[(&str, &[u8])],
    previous: Option<&str>,
) {
    publish(cdn, key, version, schema_version, entry, files);

    let pack = |path: PathBuf, contents: &[(&str, &[u8])]| {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        let mut tar = tar::Builder::new(Vec::new());
        for (name, content) in contents {
            let mut header = tar::Header::new_gnu();
            header.set_size(content.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            tar.append_data(&mut header, hash(content), *content)
                .unwrap();
            let _ = name;
        }
        let raw = tar.into_inner().unwrap();
        std::fs::write(&path, zstd::stream::encode_all(&raw[..], 3).unwrap()).unwrap();
    };

    pack(cdn.join(fetch::full_pack_key(&plat(), version)), files);

    if let Some(from) = previous {
        // Only blobs this hop actually introduces, which is the entire
        // point of a delta.
        let outer: Value = serde_json::from_slice(
            &std::fs::read(cdn.join(fetch::manifest_key(&plat(), from))).unwrap(),
        )
        .unwrap();
        let inner: Value = serde_json::from_str(outer["manifest"].as_str().unwrap()).unwrap();
        let had: std::collections::HashSet<String> = inner["files"]
            .as_array()
            .unwrap()
            .iter()
            .map(|f| f["sha256"].as_str().unwrap().to_string())
            .collect();

        let new: Vec<(&str, &[u8])> = files
            .iter()
            .filter(|(_, c)| !had.contains(&hash(c)))
            .copied()
            .collect();
        pack(
            cdn.join(fetch::delta_pack_key(&plat(), from, version)),
            &new,
        );
    }

    let index = cdn.join(fetch::versions_key(&plat()));
    let mut versions: Vec<String> = std::fs::read(&index)
        .ok()
        .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
        .and_then(|v| {
            v["versions"].as_array().map(|a| {
                a.iter()
                    .filter_map(|s| s.as_str().map(String::from))
                    .collect()
            })
        })
        .unwrap_or_default();
    if !versions.iter().any(|v| v == version) {
        versions.push(version.to_string());
    }
    // versions/<platform>.json is nested, so its directory may not exist.
    if let Some(parent) = index.parent() {
        std::fs::create_dir_all(parent).unwrap();
    }
    std::fs::write(
        &index,
        serde_json::to_vec(&serde_json::json!({ "versions": versions })).unwrap(),
    )
    .unwrap();
}

struct Manager {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<std::process::ChildStdout>,
    /// Events streamed while waiting for responses.
    seen: Vec<(String, Value)>,
}

impl Manager {
    fn start(root: &Path, cdn: &Path, pubkey_b64: &str) -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_top-runtime-manager"))
            .arg("--root")
            .arg(root)
            .arg("--source")
            .arg(cdn)
            .env("TOP_RUNTIME_PUBKEY", pubkey_b64)
            // Fixture runtimes exit immediately instead of serving, so the
            // real five-minute startup wait would stall the suite.
            .env("TOP_RUNTIME_START_TIMEOUT", "3")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .expect("failed to start the runtime manager binary");

        let stdin = child.stdin.take().unwrap();
        let stdout = BufReader::new(child.stdout.take().unwrap());
        Self {
            child,
            stdin,
            stdout,
            seen: Vec::new(),
        }
    }

    /// Send a request and read until the matching response arrives, skipping
    /// the events that stream in between.
    fn request(&mut self, id: u64, body: Value) -> Value {
        let mut request = body;
        request["id"] = serde_json::json!(id);
        writeln!(self.stdin, "{request}").unwrap();
        self.stdin.flush().unwrap();

        loop {
            let mut line = String::new();
            let read = self.stdout.read_line(&mut line).unwrap();
            assert_ne!(read, 0, "the manager closed stdout before responding");

            let value: Value = match serde_json::from_str(line.trim()) {
                Ok(v) => v,
                Err(_) => continue,
            };
            if value.get("id").and_then(Value::as_u64) == Some(id) {
                return value;
            }
            // Keep events rather than dropping them: some behaviour is only
            // visible in what was streamed, not in the final response.
            if let Some(name) = value.get("event").and_then(Value::as_str) {
                self.seen.push((name.to_string(), value.clone()));
            }
        }
    }

    /// Every event of a given kind seen so far.
    fn events(&self, name: &str) -> Vec<&Value> {
        self.seen
            .iter()
            .filter(|(kind, _)| kind == name)
            .map(|(_, value)| value)
            .collect()
    }
}

impl Drop for Manager {
    fn drop(&mut self) {
        let _ = writeln!(self.stdin, r#"{{"cmd":"shutdown"}}"#);
        let _ = self.child.wait();
    }
}

fn fixture() -> (tempfile::TempDir, tempfile::TempDir, SigningKey, String) {
    use rand::rngs::OsRng;

    let key = SigningKey::generate(&mut OsRng);
    let pubkey = base64::engine::general_purpose::STANDARD.encode(key.verifying_key().to_bytes());
    (
        tempfile::tempdir().unwrap(),
        tempfile::tempdir().unwrap(),
        key,
        pubkey,
    )
}

#[test]
fn the_shell_can_install_and_launch_a_runtime_over_the_protocol() {
    let (root, cdn, key, pubkey) = fixture();

    // A runtime that behaves the way the real one does: binds its port,
    // announces it, then stays up until told to shut down.
    //
    // It really listens, because the manager now waits for the port to
    // answer before reporting success. A fixture that only printed the
    // announcement would be asserting the bug this replaced.
    let server = br#"
import http from "node:http";
const port = Number(process.env.TOP_HTTP_PORT);
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
});
server.listen(port, "127.0.0.1", () => {
  console.log("TOP_LISTENING " + port);
  // The real server also prints its own banner, which parses as an
  // announcement too. Both appear here so the duplicate is exercised.
  console.log("TheOpenPresenter listening on port " + port);
  console.log("state dir: " + process.env.TOP_STATE_DIR);
});
process.stdin.on("data", (d) => {
  if (String(d).includes("shutdown")) process.exit(0);
});
process.stdin.resume();
"#;

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", server)],
    );

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);

    let status = manager.request(1, serde_json::json!({"cmd": "status"}));
    assert_eq!(status["ok"], true);
    assert!(status["result"]["current"].is_null());

    let check = manager.request(2, serde_json::json!({"cmd": "check", "channel": "stable"}));
    assert_eq!(check["result"]["version"], "1.0.0");

    let ensure = manager.request(
        3,
        serde_json::json!({"cmd": "ensure", "channel": "stable", "activate": true}),
    );
    assert_eq!(ensure["ok"], true, "ensure failed: {ensure}");
    assert_eq!(ensure["result"]["version"], "1.0.0");

    let start = manager.request(4, serde_json::json!({"cmd": "start"}));
    assert_eq!(start["ok"], true, "start failed: {start}");
    let port = start["result"]["httpPort"].as_u64().unwrap();
    assert!(
        port > 1024,
        "expected a dynamically allocated port, got {port}"
    );
    assert_ne!(port, 5678, "the hardcoded port should be gone");

    let status = manager.request(5, serde_json::json!({"cmd": "status"}));
    assert_eq!(status["result"]["current"], "1.0.0");
    assert_eq!(status["result"]["running"], true);

    let stop = manager.request(6, serde_json::json!({"cmd": "stop"}));
    assert_eq!(stop["ok"], true);
}

#[test]
fn a_far_behind_client_chains_deltas_instead_of_refetching_everything() {
    // Releases only publish deltas for the last few hops. Without
    // chaining, anyone who skipped a couple of updates re-downloads the
    // whole runtime, which is the case this whole scheme exists to avoid.
    let (root, cdn, key, pubkey) = fixture();

    let bulk = vec![7u8; 400_000];
    for (i, version) in ["1.0.0", "1.1.0", "1.2.0", "1.3.0"].iter().enumerate() {
        let changed = format!("// build {i}\n").into_bytes();
        publish_with_previous(
            cdn.path(),
            &key,
            version,
            1,
            "run_server.mjs",
            &[
                ("run_server.mjs", b"process.exit(0);" as &[u8]),
                ("bulk.bin", &bulk),
                ("changed.js", &changed),
            ],
            // Only ever a delta from the immediately previous version.
            i.checked_sub(1)
                .map(|p| ["1.0.0", "1.1.0", "1.2.0", "1.3.0"][p]),
        );
    }

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
    manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "version": "1.0.0", "activate": true}),
    );

    // Remove the full pack so only the delta chain can satisfy the jump.
    std::fs::remove_file(cdn.path().join(fetch::full_pack_key(&plat(), "1.3.0"))).unwrap();
    // And the per-blob fallback, which cannot exist on a flat host such as
    // GitHub Releases.
    std::fs::remove_dir_all(cdn.path().join("blobs")).unwrap();

    let jumped = manager.request(
        2,
        serde_json::json!({"cmd": "ensure", "version": "1.3.0", "activate": true}),
    );
    assert_eq!(
        jumped["ok"], true,
        "a three-hop jump should chain deltas: {jumped}"
    );

    let status = manager.request(3, serde_json::json!({"cmd": "status"}));
    assert_eq!(status["result"]["current"], "1.3.0");
}

#[test]
fn a_client_far_behind_a_nightly_channel_still_updates() {
    // A nightly channel moves every commit, and old full packs are trimmed
    // to keep the release from growing without bound. Someone who last
    // updated 20 nightlies ago therefore finds neither a delta reaching
    // that far back nor the full pack they originally installed from.
    //
    // The update still has to work. The only thing that must survive is
    // the *current* full pack, which is what this leaves in place.
    let (root, cdn, key, pubkey) = fixture();

    let bulk = vec![9u8; 200_000];
    let versions: Vec<String> = (0..20)
        .map(|i| format!("0.0.0-nightly.2026092{}.{i:04}", i % 10))
        .collect();

    for (i, version) in versions.iter().enumerate() {
        let changed = format!("// nightly {i}\n").into_bytes();
        publish_with_previous(
            cdn.path(),
            &key,
            version,
            1,
            "run_server.mjs",
            &[
                ("run_server.mjs", b"process.exit(0);" as &[u8]),
                ("bulk.bin", &bulk),
                ("changed.js", &changed),
            ],
            i.checked_sub(1).map(|p| versions[p].as_str()),
        );
    }

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
    let first = manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "version": versions[0], "activate": true}),
    );
    assert_eq!(first["ok"], true, "initial install failed: {first}");

    // Retention: keep the newest few full packs, drop the rest. This is
    // what the workflow's trim step does to the moving tag.
    for version in &versions[..versions.len() - 3] {
        let pack = cdn.path().join(fetch::full_pack_key(&plat(), version));
        std::fs::remove_file(&pack).ok();
    }
    // Per-blob fetches do not exist on a flat host such as GitHub Releases.
    std::fs::remove_dir_all(cdn.path().join("blobs")).unwrap();

    let latest = versions.last().unwrap();
    let jumped = manager.request(
        2,
        serde_json::json!({"cmd": "ensure", "version": latest, "activate": true}),
    );
    assert_eq!(
        jumped["ok"], true,
        "a client 20 nightlies behind must still update: {jumped}"
    );

    let status = manager.request(3, serde_json::json!({"cmd": "status"}));
    assert_eq!(status["result"]["current"], latest.as_str());
}

#[test]
fn removing_a_running_version_stops_it_first() {
    // Deleting the files under a live server leaves it serving a
    // directory that no longer exists, and PostgreSQL holding its port so
    // the next start fails. The removal has to stop it first.
    let (root, cdn, key, pubkey) = fixture();

    let server = br#"
import http from "node:http";
const port = Number(process.env.TOP_HTTP_PORT);
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("ok");
  })
  .listen(port, "127.0.0.1", () => console.log("TOP_LISTENING " + port));
process.stdin.on("data", (d) => {
  if (String(d).includes("shutdown")) process.exit(0);
});
process.stdin.resume();
"#;

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", server)],
    );

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
    manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "version": "1.0.0", "activate": true}),
    );

    let start = manager.request(2, serde_json::json!({"cmd": "start"}));
    assert_eq!(start["ok"], true, "start failed: {start}");
    let port = start["result"]["httpPort"].as_u64().unwrap() as u16;
    assert!(std::net::TcpStream::connect(("127.0.0.1", port)).is_ok());

    let removed = manager.request(3, serde_json::json!({"cmd": "remove", "version": "1.0.0"}));
    assert_eq!(removed["ok"], true, "remove failed: {removed}");

    // The server is gone, so its port is free again.
    let mut released = false;
    for _ in 0..40 {
        if std::net::TcpStream::connect(("127.0.0.1", port)).is_err() {
            released = true;
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    assert!(
        released,
        "port {port} is still held; the runtime was deleted without being stopped"
    );

    // And the manager knows nothing is running.
    let status = manager.request(4, serde_json::json!({"cmd": "status"}));
    assert_eq!(status["result"]["running"], false);
}

#[test]
fn removing_the_active_version_falls_back_and_keeps_user_data() {
    // Deleting the runtime in use is the obvious thing to want when it is
    // broken. Refusing would push people to `rm -rf`, which leaves the
    // active pointer aimed at a directory that no longer exists.
    let (root, cdn, key, pubkey) = fixture();
    let noop = b"process.exit(0);";

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", noop)],
    );
    publish(
        cdn.path(),
        &key,
        "2.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", noop)],
    );

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
    manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "version": "1.0.0", "activate": true}),
    );
    manager.request(
        2,
        serde_json::json!({"cmd": "ensure", "version": "2.0.0", "activate": true}),
    );

    // Something irreplaceable, to prove removal does not touch it.
    let marker = root.path().join("data/uploads/sermon.mp4");
    std::fs::create_dir_all(marker.parent().unwrap()).unwrap();
    std::fs::write(&marker, b"a recording").unwrap();

    let removed = manager.request(3, serde_json::json!({"cmd": "remove", "version": "2.0.0"}));
    assert_eq!(removed["ok"], true, "remove failed: {removed}");
    assert_eq!(removed["result"]["wasActive"], true);
    assert_eq!(
        removed["result"]["active"], "1.0.0",
        "removing the active version should fall back to another installed one"
    );

    // The tree is gone, the pointer is valid, the data survived.
    assert!(!root.path().join("versions/2.0.0").exists());
    assert!(root.path().join("versions/1.0.0").exists());
    assert_eq!(std::fs::read(&marker).unwrap(), b"a recording");

    let status = manager.request(4, serde_json::json!({"cmd": "status"}));
    assert_eq!(status["result"]["current"], "1.0.0");
}

#[test]
fn removing_the_only_version_leaves_a_usable_empty_state() {
    // The pointer must not be left aimed at a deleted directory, or every
    // later command fails with a confusing missing-file error.
    let (root, cdn, key, pubkey) = fixture();

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", b"process.exit(0);")],
    );

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
    manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "version": "1.0.0", "activate": true}),
    );

    let removed = manager.request(2, serde_json::json!({"cmd": "remove", "version": "1.0.0"}));
    assert_eq!(removed["ok"], true, "remove failed: {removed}");
    assert_eq!(removed["result"]["active"], serde_json::Value::Null);

    let status = manager.request(3, serde_json::json!({"cmd": "status"}));
    assert_eq!(status["ok"], true, "status broke after removal: {status}");
    assert_eq!(status["result"]["current"], serde_json::Value::Null);
    assert_eq!(status["result"]["installed"].as_array().unwrap().len(), 0);

    // And reinstalling works, rather than tripping over stale state.
    let again = manager.request(
        4,
        serde_json::json!({"cmd": "ensure", "version": "1.0.0", "activate": true}),
    );
    assert_eq!(again["ok"], true, "reinstall failed: {again}");
}

#[test]
fn removing_a_version_that_is_not_installed_says_so() {
    let (root, cdn, _key, pubkey) = fixture();
    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);

    let removed = manager.request(1, serde_json::json!({"cmd": "remove", "version": "9.9.9"}));
    assert_eq!(removed["ok"], false);
    assert!(
        removed["error"]
            .as_str()
            .unwrap_or_default()
            .contains("not installed"),
        "got: {removed}"
    );
}

#[test]
fn the_port_is_announced_exactly_once() {
    // The runtime says it is listening twice: the structured line meant for
    // us, and the server's own banner. A shell that navigates its window on
    // this event would do it twice, and the second navigation can land on a
    // URL that is no longer the right one.
    let (root, cdn, key, pubkey) = fixture();

    // Announces twice, the way the real runtime does.
    let noisy = br#"
import http from "node:http";
const port = Number(process.env.TOP_HTTP_PORT);
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("ok");
  })
  .listen(port, "127.0.0.1", () => {
    console.log("TOP_LISTENING " + port);
    console.log("TheOpenPresenter listening on port " + port);
  });
process.stdin.on("data", (d) => {
  if (String(d).includes("shutdown")) process.exit(0);
});
process.stdin.resume();
"#;

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", noisy)],
    );

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
    manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "channel": "stable", "activate": true}),
    );
    let start = manager.request(2, serde_json::json!({"cmd": "start"}));
    assert_eq!(start["ok"], true, "start failed: {start}");

    let announcements = manager.events("listening").len();
    assert_eq!(
        announcements, 1,
        "expected one listening event, got {announcements}"
    );
}

#[test]
fn start_does_not_report_a_port_before_it_answers() {
    // The bug: start returned as soon as the process spawned, so the shell
    // navigated to a URL that refused connections while PostgreSQL was
    // still initialising. The user saw a blank window and a port that
    // looked right.
    let (root, cdn, key, pubkey) = fixture();

    // A runtime that takes a moment to bind, like the real one.
    let slow = br#"
import http from "node:http";
const port = Number(process.env.TOP_HTTP_PORT);
setTimeout(() => {
  http
    .createServer((req, res) => {
      res.writeHead(200);
      res.end("ok");
    })
    .listen(port, "127.0.0.1", () => console.log("TOP_LISTENING " + port));
}, 1500);
process.stdin.on("data", (d) => {
  if (String(d).includes("shutdown")) process.exit(0);
});
process.stdin.resume();
"#;

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", slow)],
    );

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
    manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "channel": "stable", "activate": true}),
    );

    let start = manager.request(2, serde_json::json!({"cmd": "start"}));
    assert_eq!(start["ok"], true, "start failed: {start}");

    // The moment start returns, the port must already be usable.
    let port = start["result"]["httpPort"].as_u64().unwrap() as u16;
    assert!(
        std::net::TcpStream::connect(("127.0.0.1", port)).is_ok(),
        "start reported port {port} but nothing is listening on it"
    );
}

#[test]
fn a_runtime_that_dies_on_startup_is_reported_promptly() {
    // A crash at boot must not look like a slow start: waiting out the
    // full timeout on a process that exited immediately wastes minutes
    // and tells the user nothing.
    let (root, cdn, key, pubkey) = fixture();

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[(
            "run_server.mjs",
            b"console.error('cannot find module');process.exit(1);",
        )],
    );

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
    manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "channel": "stable", "activate": true}),
    );

    let began = std::time::Instant::now();
    let start = manager.request(2, serde_json::json!({"cmd": "start"}));
    let took = began.elapsed();

    assert_eq!(start["ok"], false, "a dead runtime must not report success");
    let error = start["error"].as_str().unwrap_or_default();
    assert!(
        error.contains("stopped"),
        "the error should say the server stopped, got: {error}"
    );
    // It must also point at the log, which is the only way to see why.
    assert!(
        error.contains("runtime.log"),
        "the error should name the log file, got: {error}"
    );
    assert!(
        took < std::time::Duration::from_secs(3),
        "a dead process should be detected promptly, took {took:?}"
    );
}

#[test]
fn the_runtime_log_is_written_to_disk() {
    // "It got stuck starting" is unanswerable without a log that outlives
    // the process.
    let (root, cdn, key, pubkey) = fixture();

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[(
            "run_server.mjs",
            b"console.log('a distinctive startup line');process.exit(1);",
        )],
    );

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
    manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "channel": "stable", "activate": true}),
    );
    manager.request(2, serde_json::json!({"cmd": "start"}));

    let log = root.path().join("logs/runtime.log");
    let contents = std::fs::read_to_string(&log)
        .unwrap_or_else(|e| panic!("no log at {}: {e}", log.display()));
    assert!(
        contents.contains("a distinctive startup line"),
        "the runtime's output should be in the log, got: {contents}"
    );
}

#[test]
fn downloading_an_update_does_not_switch_to_it() {
    // The failure this prevents: a background update finishes mid-service
    // and the next restart silently runs a different version than the one
    // the operator tested with. Downloading and switching are separate
    // decisions.
    let (root, cdn, key, pubkey) = fixture();

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", b"process.exit(0);\n// v1")],
    );
    {
        let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
        manager.request(
            1,
            serde_json::json!({"cmd": "ensure", "version": "1.0.0", "activate": true}),
        );
    }

    publish(
        cdn.path(),
        &key,
        "2.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", b"process.exit(0);\n// v2")],
    );
    {
        let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);

        // Download only.
        let ensure = manager.request(1, serde_json::json!({"cmd": "ensure", "version": "2.0.0"}));
        assert_eq!(ensure["ok"], true, "download failed: {ensure}");
        assert_eq!(ensure["result"]["activated"], false);

        let status = manager.request(2, serde_json::json!({"cmd": "status"}));
        assert_eq!(
            status["result"]["current"], "1.0.0",
            "downloading must not change the active version"
        );

        // Both are on disk, so the switch is instant when it is wanted.
        let installed = status["result"]["installed"].as_array().unwrap();
        assert_eq!(installed.len(), 2, "the new version should be present");

        let activated = manager.request(
            3,
            serde_json::json!({"cmd": "activate", "version": "2.0.0"}),
        );
        assert_eq!(activated["ok"], true, "activate failed: {activated}");

        let status = manager.request(4, serde_json::json!({"cmd": "status"}));
        assert_eq!(status["result"]["current"], "2.0.0");
    }
}

/// Rewrite a published manifest so it declares a larger size, re-signing
/// it so it stays valid.
///
/// Used to exercise the disk-space check without needing a real full
/// filesystem, which is not something a test can arrange portably.
fn inflate_declared_size(cdn: &Path, key: &SigningKey, version: &str, size: u64) {
    let manifest_path = cdn.join(fetch::manifest_key(&plat(), version));
    let outer: Value = serde_json::from_slice(&std::fs::read(&manifest_path).unwrap()).unwrap();
    let mut manifest: Value = serde_json::from_str(outer["manifest"].as_str().unwrap()).unwrap();

    manifest["files"][0]["size"] = serde_json::json!(size);

    let manifest_json = serde_json::to_string(&manifest).unwrap();
    let signature = base64::engine::general_purpose::STANDARD
        .encode(key.sign(manifest_json.as_bytes()).to_bytes());
    std::fs::write(
        &manifest_path,
        serde_json::to_vec(&serde_json::json!({
            "manifest": manifest_json,
            "signature": signature,
        }))
        .unwrap(),
    )
    .unwrap();
}

#[test]
fn an_install_that_would_not_fit_is_refused_before_downloading() {
    // Filling the disk part-way through writing a release can take
    // PostgreSQL down with it. Refusing up front costs one syscall; the
    // alternative costs the user a corrupted database mid-service.
    let (root, cdn, key, pubkey) = fixture();

    // A manifest claiming a size no filesystem here can satisfy. The blob
    // content is small: the check must happen before any download, so the
    // declared size is what matters.
    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", b"process.exit(0);")],
    );

    // Rewrite the manifest to declare an impossible size, re-signing it so
    // it stays valid: this tests the space check, not signature handling.
    inflate_declared_size(cdn.path(), &key, "1.0.0", u64::MAX / 4);

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
    let response = manager.request(1, serde_json::json!({"cmd": "ensure", "version": "1.0.0"}));

    assert_eq!(response["ok"], false, "expected a refusal: {response}");
    let error = response["error"].as_str().unwrap_or_default();
    assert!(
        error.contains("disk space"),
        "the error should name the real problem, got: {error}"
    );
    // It must also say what to do about it.
    assert!(
        error.contains("prune") || error.contains("Free some space"),
        "the error should tell the user how to recover, got: {error}"
    );

    // Nothing was installed.
    let status = manager.request(2, serde_json::json!({"cmd": "status"}));
    assert_eq!(status["result"]["current"], serde_json::Value::Null);
}

#[test]
fn an_installed_version_can_be_activated_offline() {
    // Offline operation is the reason to install a runtime at all. An
    // activate that reached for the network would fail on exactly the
    // machine the feature exists for: a church hall with no internet.
    let (root, cdn, key, pubkey) = fixture();

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", b"process.exit(0);")],
    );
    publish(
        cdn.path(),
        &key,
        "2.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", b"process.exit(0);\n// v2")],
    );

    {
        let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
        manager.request(
            1,
            serde_json::json!({"cmd": "ensure", "version": "1.0.0", "activate": true}),
        );
        manager.request(2, serde_json::json!({"cmd": "ensure", "version": "2.0.0"}));
    }

    // Point at a source that cannot be reached at all.
    let unreachable = root.path().join("no-such-directory");
    {
        let mut manager = Manager::start(root.path(), &unreachable, &pubkey);

        let activated = manager.request(
            1,
            serde_json::json!({"cmd": "activate", "version": "2.0.0"}),
        );
        assert_eq!(
            activated["ok"], true,
            "activating an installed version must not need the network: {activated}"
        );

        let status = manager.request(2, serde_json::json!({"cmd": "status"}));
        assert_eq!(status["result"]["current"], "2.0.0");
    }
}

#[test]
fn state_survives_an_upgrade() {
    let (root, cdn, key, pubkey) = fixture();
    let noop = b"process.exit(0);";

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", noop)],
    );
    {
        let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
        assert_eq!(
            manager.request(
                1,
                serde_json::json!({"cmd": "ensure", "channel": "stable", "activate": true})
            )["ok"],
            true
        );
    }

    // Write something into the state dir, then upgrade.
    let marker = root.path().join("data/uploads/song.mp4");
    std::fs::create_dir_all(marker.parent().unwrap()).unwrap();
    std::fs::write(&marker, b"user data").unwrap();

    publish(
        cdn.path(),
        &key,
        "1.1.0",
        2,
        "run_server.mjs",
        &[("run_server.mjs", b"process.exit(0);\n// v2")],
    );
    {
        let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);
        let ensure = manager.request(
            1,
            serde_json::json!({"cmd": "ensure", "channel": "stable", "activate": true}),
        );
        assert_eq!(ensure["result"]["version"], "1.1.0");
    }

    assert_eq!(
        std::fs::read(&marker).unwrap(),
        b"user data",
        "upgrading must never touch the state directory"
    );
    assert!(
        root.path().join("versions/1.0.0").exists(),
        "the previous runtime must survive for rollback"
    );
}

#[test]
fn a_rollback_past_a_migration_is_refused_over_the_protocol() {
    let (root, cdn, key, pubkey) = fixture();
    let noop = b"process.exit(0);";

    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", noop)],
    );
    publish(
        cdn.path(),
        &key,
        "2.0.0",
        5,
        "run_server.mjs",
        &[("run_server.mjs", b"process.exit(0);//2")],
    );

    let mut manager = Manager::start(root.path(), cdn.path(), &pubkey);

    manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "version": "1.0.0", "activate": true}),
    );
    let ensure = manager.request(
        2,
        serde_json::json!({"cmd": "ensure", "version": "2.0.0", "activate": true}),
    );
    assert_eq!(ensure["ok"], true);

    manager.request(
        3,
        serde_json::json!({"cmd": "record_migration", "schema_version": 5}),
    );

    let rollback = manager.request(
        4,
        serde_json::json!({"cmd": "activate", "version": "1.0.0"}),
    );
    assert_eq!(rollback["ok"], false, "rollback should have been refused");
    assert!(
        rollback["error"]
            .as_str()
            .unwrap()
            .contains("Refusing to activate"),
        "unexpected error: {rollback}"
    );
}

#[test]
fn a_release_signed_by_the_wrong_key_is_refused() {
    use rand::rngs::OsRng;

    let (root, cdn, key, _) = fixture();
    publish(
        cdn.path(),
        &key,
        "1.0.0",
        1,
        "run_server.mjs",
        &[("run_server.mjs", b"process.exit(0);")],
    );

    // The manager trusts a different key than the one that signed.
    let other = SigningKey::generate(&mut OsRng);
    let wrong_pubkey =
        base64::engine::general_purpose::STANDARD.encode(other.verifying_key().to_bytes());

    let mut manager = Manager::start(root.path(), cdn.path(), &wrong_pubkey);
    let ensure = manager.request(
        1,
        serde_json::json!({"cmd": "ensure", "channel": "stable", "activate": true}),
    );

    assert_eq!(ensure["ok"], false, "an untrusted release must not install");
    assert!(
        !root.path().join("versions/1.0.0").exists(),
        "nothing should have been written"
    );
}
