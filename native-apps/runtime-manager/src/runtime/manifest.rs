//! Release manifests and their signatures.
//!
//! A manifest lists every file in a runtime with its hash, size and mode. One
//! ed25519 signature covers the manifest bytes; blob integrity then follows
//! from the hashes inside it.

use anyhow::{anyhow, bail, Context, Result};
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

/// Production signing key, baked in at compile time by `build.rs` from
/// `TOP_RUNTIME_PUBKEY` (CI) or `dev-pubkey.txt` (local development).
/// Overridden at runtime by `TOP_RUNTIME_PUBKEY` for testing.
pub const DEFAULT_PUBKEY_B64: &str = env!("TOP_RUNTIME_BAKED_PUBKEY");

/// One file in a runtime tree.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileEntry {
    /// Path relative to the runtime root, always forward-slash separated.
    pub path: String,
    pub sha256: String,
    pub size: u64,
    /// Unix mode as an octal string, e.g. "0755". Only the executable bit is
    /// applied on Windows-hosted installs (where it is ignored entirely).
    #[serde(default = "default_mode")]
    pub mode: String,
    /// When set, this entry is a symlink pointing at this relative target
    /// rather than a file with content.
    ///
    /// Shared libraries depend on soname chains
    /// (`libicuuc.so.60` -> `libicuuc.so.60.2`). Collapsing those into
    /// copies loses the names the dynamic linker actually looks up, and
    /// PostgreSQL then fails to start with a misleading exit 127.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
}

fn default_mode() -> String {
    "0644".to_string()
}

impl FileEntry {
    pub fn is_executable(&self) -> bool {
        u32::from_str_radix(self.mode.trim_start_matches("0o"), 8)
            .map(|m| m & 0o111 != 0)
            .unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: String,
    /// Lowest shell version that can run this runtime.
    #[serde(default)]
    pub min_shell: Option<String>,
    /// Monotonic counter bumped whenever a release adds database migrations.
    /// Rollback is bounded by this, not by version ordering.
    #[serde(default)]
    pub schema_version: u32,
    /// Entrypoint, relative to the runtime root.
    pub entry: String,
    /// Plugins this runtime ships and the server should load.
    ///
    /// Carried in the manifest so the launcher does not need a second
    /// copy of the list: the runtime declares what it contains, and an
    /// older release keeps working after the set changes.
    #[serde(default)]
    pub plugins: Vec<String>,
    pub files: Vec<FileEntry>,
}

impl Manifest {
    pub fn total_size(&self) -> u64 {
        self.files.iter().map(|f| f.size).sum()
    }

    pub fn find(&self, path: &str) -> Option<&FileEntry> {
        self.files.iter().find(|f| f.path == path)
    }

    /// Reject manifests that could write outside the runtime directory. Path
    /// traversal in a downloaded manifest is the same class of bug as an
    /// unsigned download, so it is checked even though the signature should
    /// already have ruled it out.
    pub fn validate_paths(&self) -> Result<()> {
        for file in &self.files {
            let p = &file.path;
            if p.is_empty() {
                bail!("Manifest contains an entry with an empty path");
            }
            if p.starts_with('/') || p.starts_with('\\') {
                bail!("Manifest entry is an absolute path: {p}");
            }
            if p.split(['/', '\\']).any(|seg| seg == "..") {
                bail!("Manifest entry escapes the runtime root: {p}");
            }
            // A Windows drive prefix would also escape the root.
            if p.len() >= 2 && p.as_bytes()[1] == b':' {
                bail!("Manifest entry is an absolute path: {p}");
            }

            // A symlink target is just as dangerous as a path: an unchecked
            // one writes a link pointing anywhere on the filesystem.
            if let Some(target) = &file.link {
                if target.is_empty() {
                    bail!("Manifest entry {p} is a symlink with no target");
                }
                if target.starts_with('/') || target.starts_with('\\') {
                    bail!("Symlink {p} points outside the runtime: {target}");
                }
                if target.len() >= 2 && target.as_bytes()[1] == b':' {
                    bail!("Symlink {p} points outside the runtime: {target}");
                }
                if !link_stays_inside(p, target) {
                    bail!("Symlink {p} escapes the runtime root: {target}");
                }
            }
        }
        Ok(())
    }
}

/// Whether following `target` from the directory holding `path` stays within
/// the runtime root. Purely textual: the tree does not exist yet.
fn link_stays_inside(path: &str, target: &str) -> bool {
    let mut depth: i32 = path.split('/').count() as i32 - 1;
    for segment in target.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                depth -= 1;
                if depth < 0 {
                    return false;
                }
            }
            _ => depth += 1,
        }
    }
    true
}

/// Every version a source has published, oldest first.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VersionIndex {
    pub versions: Vec<String>,
}

/// What a channel file points at. Small, fetched often.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelPointer {
    pub channel: String,
    pub version: String,
}

/// A manifest plus its detached signature, as published.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedManifest {
    /// The manifest serialised as JSON. Kept as raw text because the
    /// signature covers exactly these bytes; re-serialising could change
    /// key order or spacing and invalidate a valid signature.
    pub manifest: String,
    /// base64 standard encoding of the 64-byte ed25519 signature.
    pub signature: String,
}

impl SignedManifest {
    /// Verify the signature and parse the manifest. There is deliberately no
    /// way to parse one without verifying it.
    pub fn verify(&self, pubkey: &VerifyingKey) -> Result<Manifest> {
        let sig_bytes = base64::engine::general_purpose::STANDARD
            .decode(self.signature.trim())
            .context("Manifest signature is not valid base64")?;
        let sig_array: [u8; 64] = sig_bytes
            .try_into()
            .map_err(|_| anyhow!("Manifest signature is not 64 bytes"))?;
        let signature = Signature::from_bytes(&sig_array);

        pubkey
            .verify(self.manifest.as_bytes(), &signature)
            .map_err(|_| anyhow!("Manifest signature does not verify against the trusted key"))?;

        let manifest: Manifest = serde_json::from_str(&self.manifest)
            .context("Manifest signature verified but the body is not valid JSON")?;
        manifest.validate_paths()?;
        Ok(manifest)
    }
}

/// The key manifests are checked against. `TOP_RUNTIME_PUBKEY` wins so a
/// development build can point at a locally signed release.
pub fn trusted_pubkey() -> Result<VerifyingKey> {
    let encoded = match std::env::var("TOP_RUNTIME_PUBKEY") {
        Ok(v) if !v.trim().is_empty() => v,
        _ => DEFAULT_PUBKEY_B64.to_string(),
    };

    if encoded.trim().is_empty() {
        bail!(
            "No runtime signing key is configured. Set TOP_RUNTIME_PUBKEY, or \
             build with DEFAULT_PUBKEY_B64 set to the release key."
        );
    }

    parse_pubkey(&encoded)
}

pub fn parse_pubkey(encoded: &str) -> Result<VerifyingKey> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded.trim())
        .context("Signing key is not valid base64")?;
    let array: [u8; 32] = bytes
        .try_into()
        .map_err(|_| anyhow!("Signing key is not 32 bytes"))?;
    VerifyingKey::from_bytes(&array).context("Signing key is not a valid ed25519 public key")
}

#[cfg(test)]
mod tests {
    use ed25519_dalek::{Signer, SigningKey};
    use rand::rngs::OsRng;

    use super::*;

    fn sign(manifest_json: &str, key: &SigningKey) -> SignedManifest {
        SignedManifest {
            manifest: manifest_json.to_string(),
            signature: base64::engine::general_purpose::STANDARD
                .encode(key.sign(manifest_json.as_bytes()).to_bytes()),
        }
    }

    fn sample_json() -> String {
        serde_json::to_string(&Manifest {
            version: "1.9.0".into(),
            min_shell: Some("1.4.0".into()),
            schema_version: 7,
            entry: "run_server.mjs".into(),
            plugins: vec![],
            files: vec![FileEntry {
                path: "run_server.mjs".into(),
                sha256: "ab".repeat(32),
                size: 40213,
                mode: "0644".into(),
                link: None,
            }],
        })
        .unwrap()
    }

    #[test]
    fn a_valid_signature_verifies() {
        let key = SigningKey::generate(&mut OsRng);
        let json = sample_json();
        let signed = sign(&json, &key);

        let manifest = signed.verify(&key.verifying_key()).unwrap();
        assert_eq!(manifest.version, "1.9.0");
        assert_eq!(manifest.schema_version, 7);
    }

    #[test]
    fn a_tampered_manifest_is_rejected() {
        let key = SigningKey::generate(&mut OsRng);
        let mut signed = sign(&sample_json(), &key);
        signed.manifest = signed.manifest.replace("1.9.0", "6.6.6");

        assert!(signed.verify(&key.verifying_key()).is_err());
    }

    #[test]
    fn a_signature_from_another_key_is_rejected() {
        let real = SigningKey::generate(&mut OsRng);
        let attacker = SigningKey::generate(&mut OsRng);
        let signed = sign(&sample_json(), &attacker);

        assert!(signed.verify(&real.verifying_key()).is_err());
    }

    #[test]
    fn path_traversal_is_rejected_even_when_signed() {
        let key = SigningKey::generate(&mut OsRng);
        let json = serde_json::to_string(&Manifest {
            version: "1.9.0".into(),
            min_shell: None,
            schema_version: 1,
            entry: "run_server.mjs".into(),
            plugins: vec![],
            files: vec![FileEntry {
                path: "../../../etc/cron.d/pwn".into(),
                sha256: "cd".repeat(32),
                size: 1,
                mode: "0755".into(),
                link: None,
            }],
        })
        .unwrap();

        let err = sign(&json, &key)
            .verify(&key.verifying_key())
            .unwrap_err()
            .to_string();
        assert!(err.contains("escapes the runtime root"), "{err}");
    }

    #[test]
    fn absolute_paths_are_rejected() {
        for bad in ["/etc/passwd", "C:\\windows\\system32\\x.dll"] {
            let m = Manifest {
                version: "1".into(),
                min_shell: None,
                schema_version: 1,
                entry: "e".into(),
                plugins: vec![],
                files: vec![FileEntry {
                    path: bad.into(),
                    sha256: "00".repeat(32),
                    size: 0,
                    mode: "0644".into(),
                    link: None,
                }],
            };
            assert!(m.validate_paths().is_err(), "{bad} should be rejected");
        }
    }

    #[test]
    fn a_symlink_escaping_the_root_is_rejected() {
        // A soname link is relative and stays put; one that climbs out of
        // the tree would write a link pointing anywhere on the filesystem.
        let entry = |path: &str, target: &str| Manifest {
            version: "1".into(),
            min_shell: None,
            schema_version: 1,
            entry: "e".into(),
            plugins: vec![],
            files: vec![FileEntry {
                path: path.into(),
                sha256: String::new(),
                size: 0,
                mode: "0777".into(),
                link: Some(target.into()),
            }],
        };

        // Legitimate soname chains.
        entry("lib/libicuuc.so.60", "libicuuc.so.60.2")
            .validate_paths()
            .unwrap();
        entry("lib/a/x.so", "../b/y.so").validate_paths().unwrap();

        // Escapes and absolutes.
        for (path, target) in [
            ("lib/x.so", "../../../../etc/passwd"),
            ("lib/x.so", "/etc/passwd"),
            ("lib/x.so", "C:\\windows\\system32\\evil.dll"),
            ("lib/x.so", ""),
        ] {
            assert!(
                entry(path, target).validate_paths().is_err(),
                "{target} should be rejected"
            );
        }
    }

    #[test]
    fn executable_bit_is_read_from_the_mode() {
        let exe = FileEntry {
            path: "node".into(),
            sha256: String::new(),
            size: 0,
            mode: "0755".into(),
            link: None,
        };
        let plain = FileEntry {
            mode: "0644".into(),
            ..exe.clone()
        };
        assert!(exe.is_executable());
        assert!(!plain.is_executable());
    }
}
