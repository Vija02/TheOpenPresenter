//! Installing a runtime: resolve a version, verify its manifest, fetch only
//! the blobs we do not already have, assemble the tree by linking, activate.
//!
//! A runtime directory is never mutated in place. Assembly happens in a temp
//! directory and is renamed into place, so an interrupted install leaves a
//! stray temp directory rather than a half-built runtime that looks valid.

use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::PathBuf;

use anyhow::{bail, Context, Result};
use ed25519_dalek::VerifyingKey;

use crate::runtime::fetch::{self, Source};
use crate::runtime::manifest::{ChannelPointer, Manifest, SignedManifest, VersionIndex};
use crate::runtime::state::CurrentState;
use crate::storage::cas::Cas;
use crate::storage::link;
use crate::storage::paths::Layout;
use crate::storage::platform::Platform;

/// Reported as the install runs so the shell can show a progress bar.
#[derive(Debug, Clone)]
pub enum Progress {
    Resolved {
        version: String,
    },
    /// `total` counts blobs missing locally, not files in the manifest.
    Download {
        done: u64,
        total: u64,
        bytes: u64,
    },
    Assemble {
        done: u64,
        total: u64,
    },
    Activated {
        version: String,
    },
}

pub type ProgressFn<'a> = &'a mut dyn FnMut(Progress);

/// What happened when a version was removed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoveOutcome {
    /// The removed version was the active one.
    pub was_active: bool,
    /// What became active instead, if anything is left.
    pub fell_back_to: Option<String>,
}

pub struct Installer<'a> {
    pub layout: Layout,
    pub source: &'a dyn Source,
    pub pubkey: VerifyingKey,
    /// Which build to ask for. Defaults to the machine we are running on;
    /// overridable so one runner can publish and verify another's output.
    pub platform: Platform,
}

impl<'a> Installer<'a> {
    pub fn new(layout: Layout, source: &'a dyn Source, pubkey: VerifyingKey) -> Self {
        Self {
            layout,
            source,
            platform: Platform::current(),
            pubkey,
        }
    }

    /// The version a channel currently points at.
    pub fn resolve_channel(&self, channel: &str) -> Result<String> {
        let bytes = self
            .source
            .get(&fetch::channel_key(channel, &self.platform))
            .with_context(|| format!("Failed to resolve channel {channel}"))?;
        let pointer: ChannelPointer =
            serde_json::from_slice(&bytes).context("Channel pointer is not valid JSON")?;
        Ok(pointer.version)
    }

    /// Fetch and verify a manifest. Never returns an unverified one.
    /// Load a manifest for a version, preferring the local copy.
    pub fn load_manifest(&self, version: &str) -> Result<Manifest> {
        let local = self.layout.manifest_file(version);
        if local.is_file() {
            let bytes =
                fs::read(&local).with_context(|| format!("Failed to read {}", local.display()))?;
            if let Ok(manifest) = serde_json::from_slice::<Manifest>(&bytes) {
                return Ok(manifest);
            }
            // A corrupt local copy is not fatal while the network is
            // reachable, so fall through rather than failing outright.
            tracing::warn!("Stored manifest for {version} is unreadable; refetching");
        }
        self.fetch_manifest(version)
    }

    /// Record a verified manifest next to the runtime it describes.
    fn store_manifest(&self, manifest: &Manifest) -> Result<()> {
        let path = self.layout.manifest_file(&manifest.version);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        // Called before the tree is sealed read-only, so no unlocking is
        // needed here.
        fs::write(&path, serde_json::to_vec_pretty(manifest)?)
            .with_context(|| format!("Failed to write {}", path.display()))?;
        Ok(())
    }

    /// Fetch and verify a manifest. Never returns an unverified one.
    pub fn fetch_manifest(&self, version: &str) -> Result<Manifest> {
        let bytes = self
            .source
            .get(&fetch::manifest_key(&self.platform, version))
            .with_context(|| format!("Failed to fetch the manifest for {version}"))?;
        let signed: SignedManifest =
            serde_json::from_slice(&bytes).context("Manifest envelope is not valid JSON")?;
        let manifest = signed.verify(&self.pubkey)?;

        if manifest.version != version {
            bail!(
                "Manifest version mismatch: asked for {version}, got {}",
                manifest.version
            );
        }
        Ok(manifest)
    }

    /// Make `version` present and complete on disk. Does not activate it.
    pub fn ensure(&self, manifest: &Manifest, progress: ProgressFn<'_>) -> Result<PathBuf> {
        self.layout.ensure()?;
        let cas = Cas::new(self.layout.clone());

        progress(Progress::Resolved {
            version: manifest.version.clone(),
        });

        // Blobs we do not already have. Dedup by hash: a tree with many
        // identical small files (licences, empty index.js) only fetches one.
        let missing: Vec<_> = {
            let mut seen = HashSet::new();
            manifest
                .files
                .iter()
                // Symlinks carry no content, so they need no blob.
                .filter(|f| f.link.is_none())
                .filter(|f| seen.insert(f.sha256.clone()) && !cas.has(&f.sha256))
                .cloned()
                .collect()
        };

        if !missing.is_empty() {
            self.fetch_missing(&manifest.version, &missing, &cas, progress)?;
        }

        let runtime_dir = self.layout.runtime_dir(&manifest.version);
        if runtime_dir.exists() && self.verify_tree(manifest).is_ok() {
            return Ok(runtime_dir);
        }

        // Repair path. A damaged runtime file can mean a damaged CAS blob:
        // if a file in a runtime tree was hardlinked and then written to, the
        // write went through to the shared inode. Re-hashing the store here
        // is expensive, so it only happens once verification has already
        // failed, never on a healthy launch.
        //
        // A first install has no tree to verify and nothing can be corrupt
        // yet: every blob was hash-checked on the way into the store
        // moments ago. Re-hashing 500MB here added ten silent seconds to
        // every fresh install.
        let evicted = if runtime_dir.exists() {
            self.evict_corrupt_blobs(manifest)?
        } else {
            0
        };
        if evicted > 0 {
            tracing::warn!("Evicted {evicted} corrupt blob(s) from the store; re-fetching");
            let refetch: Vec<_> = {
                let mut seen = HashSet::new();
                manifest
                    .files
                    .iter()
                    .filter(|f| seen.insert(f.sha256.clone()) && !cas.has(&f.sha256))
                    .cloned()
                    .collect()
            };
            if !refetch.is_empty() {
                self.fetch_missing(&manifest.version, &refetch, &cas, progress)?;
            }
        }

        self.assemble(manifest, &cas, progress)?;
        Ok(runtime_dir)
    }

    /// Re-hash every blob this manifest needs and delete the ones that no
    /// longer match. Returns how many were evicted.
    fn evict_corrupt_blobs(&self, manifest: &Manifest) -> Result<usize> {
        let cas = Cas::new(self.layout.clone());
        let mut evicted = 0;
        let mut checked = HashSet::new();

        for file in &manifest.files {
            if file.link.is_some() || !checked.insert(&file.sha256) {
                continue;
            }
            let path = cas.path(&file.sha256);
            if !path.is_file() {
                continue;
            }
            let actual = crate::storage::cas::hash_file(&path)
                .with_context(|| format!("Failed to re-hash {}", path.display()))?;
            if actual != file.sha256 {
                // Assembly may have marked this blob read-only through a
                // hardlink. Restore owner-write only: clearing the read-only
                // flag wholesale would leave the blob world-writable on Unix.
                make_owner_writable(&path)?;
                fs::remove_file(&path).ok();
                evicted += 1;
            }
        }
        Ok(evicted)
    }

    /// Fetch missing blobs, preferring a pack over thousands of small GETs.
    fn fetch_missing(
        &self,
        version: &str,
        missing: &[crate::runtime::manifest::FileEntry],
        cas: &Cas,
        progress: ProgressFn<'_>,
    ) -> Result<()> {
        let total = missing.len() as u64;
        let mut bytes_done = 0u64;

        let mut packs_applied = 0usize;
        for pack_key in self.choose_packs(version) {
            let Ok(pack) = self.source.get(&pack_key) else {
                continue;
            };
            let pack_bytes = pack.len() as u64;
            let base = bytes_done;
            // Report progress while unpacking, not once at the end.
            // A 500MB pack is the common case and it is the longest
            // silent stretch of the whole install: without this the
            // UI shows nothing moving for tens of seconds and looks
            // like it has hung.
            let from_pack = self.extract_pack(&pack, cas, &mut |done| {
                progress(Progress::Download {
                    done: done.min(total),
                    total,
                    bytes: base + pack_bytes,
                });
            })?;
            bytes_done += pack_bytes;
            packs_applied += 1;
            progress(Progress::Download {
                done: from_pack.min(total),
                total,
                bytes: bytes_done,
            });
        }
        let _ = packs_applied;

        // Per-blob fetch for whatever the pack did not cover: an old or
        // unknown starting version, or a pack that is missing entirely.
        let mut done = 0u64;
        for entry in missing {
            if cas.has(&entry.sha256) {
                done += 1;
                continue;
            }
            let raw = self
                .source
                .get(&fetch::blob_key(&entry.sha256))
                .with_context(|| format!("Failed to fetch blob for {}", entry.path))?;
            bytes_done += raw.len() as u64;

            let content = decompress(&raw)?;
            cas.put(&entry.sha256, &content)
                .with_context(|| format!("Blob for {} failed verification", entry.path))?;

            done += 1;
            progress(Progress::Download {
                done,
                total,
                bytes: bytes_done,
            });
        }

        Ok(())
    }

    /// Pick the cheapest set of packs that covers this hop.
    ///
    /// A single delta is the common case. When none exists directly, the
    /// deltas are chained: 1.0.0 -> 1.2.0 -> 1.3.0 -> 1.5.0 costs a few
    /// megabytes where the full pack costs hundreds. This matters because
    /// releases only publish deltas for the last few hops, so anyone who
    /// skipped a couple of updates would otherwise re-download everything.
    ///
    /// The full pack is the backstop and is always published, which is what
    /// makes plain static hosting viable: a client whose version is too old
    /// for any delta chain still has exactly one file to fetch.
    fn choose_packs(&self, to_version: &str) -> Vec<String> {
        let installed: Vec<String> = self
            .layout
            .installed_versions()
            .into_iter()
            .filter(|v| v != to_version)
            .collect();

        // Direct hop first: one request beats three.
        for from in &installed {
            let key = fetch::delta_pack_key(&self.platform, from, to_version);
            if self.source.exists(&key) {
                return vec![key];
            }
        }

        for from in &installed {
            if let Some(chain) = self.delta_chain(from, to_version) {
                return chain;
            }
        }

        let full = fetch::full_pack_key(&self.platform, to_version);
        if self.source.exists(&full) {
            return vec![full];
        }
        Vec::new()
    }

    /// Find a path of delta packs from `from` to `to`, if one exists.
    ///
    /// Breadth-first over published versions so the chain is the shortest
    /// available. Bounded, because each hop costs a request and a long
    /// enough chain is worse than the single full pack it avoids: past
    /// roughly this many hops the deltas also stop being smaller, since
    /// each one re-ships whatever the previous one touched.
    fn delta_chain(&self, from: &str, to: &str) -> Option<Vec<String>> {
        const MAX_HOPS: usize = 12;

        let known = self.published_versions();
        let mut queue = std::collections::VecDeque::new();
        let mut seen = HashSet::new();
        queue.push_back((from.to_string(), Vec::new()));
        seen.insert(from.to_string());

        while let Some((at, path)) = queue.pop_front() {
            if path.len() >= MAX_HOPS {
                continue;
            }
            for next in &known {
                if next == &at || seen.contains(next) {
                    continue;
                }
                let key = fetch::delta_pack_key(&self.platform, &at, next);
                if !self.source.exists(&key) {
                    continue;
                }

                let mut extended = path.clone();
                extended.push(key);
                if next == to {
                    return Some(extended);
                }
                seen.insert(next.clone());
                queue.push_back((next.clone(), extended));
            }
        }
        None
    }

    /// Versions the source advertises, newest last.
    ///
    /// Read from the channel index rather than probed, because guessing
    /// version numbers to test for packs is not something that terminates.
    fn published_versions(&self) -> Vec<String> {
        self.source
            .get(&fetch::versions_key(&self.platform))
            .ok()
            .and_then(|bytes| serde_json::from_slice::<VersionIndex>(&bytes).ok())
            .map(|index| index.versions)
            .unwrap_or_default()
    }

    /// Unpack a zstd tar of blobs into the CAS. Entry names are hashes, and
    /// every entry is verified, so a bad pack cannot poison the store.
    fn extract_pack(
        &self,
        pack: &[u8],
        cas: &Cas,
        on_progress: &mut dyn FnMut(u64),
    ) -> Result<u64> {
        let decoder = zstd::stream::read::Decoder::new(pack).context("Pack is not valid zstd")?;
        let mut archive = tar::Archive::new(decoder);
        let mut count = 0u64;

        for entry in archive.entries().context("Pack is not a valid tar")? {
            let mut entry = entry?;
            let name = entry
                .path()?
                .file_name()
                .and_then(|n| n.to_str())
                .map(str::to_string);
            let Some(hash) = name else { continue };

            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)?;

            // Packs hold raw content; per-blob downloads hold compressed
            // content. Accept either so a pack can be assembled from blobs.
            let content = if crate::storage::cas::hash_bytes(&buf) == hash {
                buf
            } else {
                decompress(&buf)?
            };

            if cas.put(&hash, &content).is_ok() {
                count += 1;
                // Every 100 blobs rather than every one: 15,000 events
                // would spend more time writing JSON than unpacking.
                if count.is_multiple_of(100) {
                    on_progress(count);
                }
            }
        }
        Ok(count)
    }

    /// Build the runtime tree from the CAS.
    fn assemble(&self, manifest: &Manifest, cas: &Cas, progress: ProgressFn<'_>) -> Result<()> {
        let final_dir = self.layout.runtime_dir(&manifest.version);
        let staging = self
            .layout
            .tmp_dir()
            .join(format!("assemble-{}", manifest.version));

        if staging.exists() {
            link::set_tree_readonly(&staging, false);
            fs::remove_dir_all(&staging).ok();
        }
        fs::create_dir_all(&staging)?;

        let total = manifest.files.len() as u64;
        for (index, file) in manifest.files.iter().enumerate() {
            let dest = staging.join(file.path.replace('\\', "/"));

            if let Some(target) = &file.link {
                crate::storage::link::place_symlink(target, &dest)?;
            } else {
                let src = cas.path(&file.sha256);
                if !src.is_file() {
                    bail!(
                        "Blob for {} is missing from the store after download",
                        file.path
                    );
                }
                link::place(&src, &dest, file.is_executable())?;
            }

            if index % 250 == 0 || index as u64 + 1 == total {
                progress(Progress::Assemble {
                    done: index as u64 + 1,
                    total,
                });
            }
        }

        // Swap into place. The old directory is moved aside first so the
        // rename cannot fail on a non-empty target.
        if final_dir.exists() {
            let condemned = self.layout.tmp_dir().join(format!(
                "old-{}-{}",
                manifest.version,
                std::process::id()
            ));
            link::set_tree_readonly(&final_dir, false);
            fs::rename(&final_dir, &condemned).ok();
            fs::remove_dir_all(&condemned).ok();
        }
        if let Some(parent) = final_dir.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(&staging, &final_dir).with_context(|| {
            format!(
                "Failed to move the new runtime into {}",
                final_dir.display()
            )
        })?;

        // Record the verified manifest inside the tree before sealing it,
        // so activating or starting this version later needs no network.
        self.store_manifest(manifest)?;

        link::set_tree_readonly(&final_dir, true);
        Ok(())
    }

    /// Bytes of this manifest the content store already holds.
    ///
    /// An update mostly relinks files it already has, so charging it the
    /// full release size would refuse updates on a machine with ample room
    /// for the actual delta.
    pub fn bytes_already_held(&self, manifest: &Manifest) -> u64 {
        let cas = Cas::new(self.layout.clone());
        let mut seen = HashSet::new();
        manifest
            .files
            .iter()
            .filter(|f| f.link.is_none())
            .filter(|f| seen.insert(f.sha256.clone()))
            .filter(|f| cas.has(&f.sha256))
            .map(|f| f.size)
            .sum()
    }

    /// Check an installed tree against its manifest. Sizes only: hashing
    /// ~700MB on every launch would add seconds to startup, and the hash was
    /// already verified when each blob entered the CAS.
    pub fn verify_tree(&self, manifest: &Manifest) -> Result<()> {
        let root = self.layout.runtime_dir(&manifest.version);
        for file in &manifest.files {
            let path = root.join(&file.path);

            if file.link.is_some() {
                // symlink_metadata, not metadata: a soname link whose target
                // is missing must be reported, and a dangling link makes
                // metadata fail in a way that reads as "file missing".
                fs::symlink_metadata(&path)
                    .with_context(|| format!("Runtime symlink missing: {}", file.path))?;
                continue;
            }

            let meta = fs::metadata(&path)
                .with_context(|| format!("Runtime file missing: {}", file.path))?;
            if meta.len() != file.size {
                bail!(
                    "Runtime file {} is {} bytes, expected {}",
                    file.path,
                    meta.len(),
                    file.size
                );
            }
        }
        Ok(())
    }

    /// Activate an installed runtime, refusing rollbacks that the database
    /// schema has already moved past.
    pub fn activate(&self, manifest: &Manifest) -> Result<()> {
        let current_path = self.layout.current_file();
        let mut state = CurrentState::load(&current_path)?;
        state.activate(&manifest.version, manifest.schema_version)?;
        state.save(&current_path)?;
        Ok(())
    }

    /// Delete one installed version, whether or not it is active.
    ///
    /// Removing the active version is allowed on purpose: it is the
    /// obvious thing to want when a runtime is broken, and refusing would
    /// send people to `rm -rf` instead, which leaves `config.json`
    /// pointing at a directory that no longer exists.
    pub fn remove(&self, version: &str) -> Result<RemoveOutcome> {
        let dir = self.layout.runtime_dir(version);
        if !dir.exists() {
            bail!("{version} is not installed");
        }

        let mut state = CurrentState::load(&self.layout.current_file())?;
        let was_active = state.current.as_deref() == Some(version);

        link::set_tree_readonly(&dir, false);
        fs::remove_dir_all(&dir).with_context(|| format!("Failed to remove {}", dir.display()))?;

        // Fall back to another installed version rather than leaving the
        // pointer dangling. Preferring the last known-good one means a
        // user deleting a broken runtime lands somewhere that worked.
        let mut fell_back_to = None;
        if was_active {
            let remaining = self.layout.installed_versions();
            let next = state
                .last_good
                .clone()
                .filter(|v| v != version && remaining.contains(v))
                .or_else(|| remaining.last().cloned());

            state.current = next.clone();
            if state.last_good.as_deref() == Some(version) {
                state.last_good = next.clone();
            }
            state.crash_count = 0;
            state.save(&self.layout.current_file())?;
            fell_back_to = next;
        }

        Ok(RemoveOutcome {
            was_active,
            fell_back_to,
        })
    }

    /// Remove an installed runtime and reclaim blobs nothing else needs.
    pub fn prune(&self, keep: &[String]) -> Result<u64> {
        let keep_set: HashSet<&String> = keep.iter().collect();
        for version in self.layout.installed_versions() {
            if keep_set.contains(&version) {
                continue;
            }
            let dir = self.layout.runtime_dir(&version);
            link::set_tree_readonly(&dir, false);
            fs::remove_dir_all(&dir).ok();
        }

        let mut live = HashSet::new();
        for version in keep {
            // The stored manifest, not the network. Pruning offline used
            // to find no live blobs and delete the entire content store,
            // forcing a full re-download of the runtime still installed.
            if let Ok(manifest) = self.load_manifest(version) {
                for file in manifest.files {
                    live.insert(file.sha256);
                }
            }
        }
        Cas::new(self.layout.clone()).gc(&live)
    }
}

/// Restore owner-write permission on a file the runtime assembly marked
/// read-only, without widening access to anyone else.
#[cfg(unix)]
fn make_owner_writable(path: &std::path::Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut perms = fs::metadata(path)?.permissions();
    perms.set_mode(perms.mode() | 0o200);
    fs::set_permissions(path, perms).ok();
    Ok(())
}

#[cfg(not(unix))]
fn make_owner_writable(path: &std::path::Path) -> Result<()> {
    let mut perms = fs::metadata(path)?.permissions();
    #[allow(clippy::permissions_set_readonly_false)]
    perms.set_readonly(false);
    fs::set_permissions(path, perms).ok();
    Ok(())
}

/// Blobs are published zstd-compressed, but accepting raw content too means a
/// hand-assembled or locally built release works without a compression step.
fn decompress(bytes: &[u8]) -> Result<Vec<u8>> {
    const ZSTD_MAGIC: [u8; 4] = [0x28, 0xb5, 0x2f, 0xfd];
    if bytes.len() >= 4 && bytes[..4] == ZSTD_MAGIC {
        zstd::stream::decode_all(bytes).context("Failed to decompress blob")
    } else {
        Ok(bytes.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use ed25519_dalek::{Signer, SigningKey};
    use rand::rngs::OsRng;

    use super::*;
    use crate::runtime::fetch::DirSource;
    use crate::runtime::manifest::FileEntry;
    use crate::storage::cas::hash_bytes;

    /// Builds a CDN-shaped directory holding one release.
    struct Release {
        dir: tempfile::TempDir,
        key: SigningKey,
        platform: Platform,
    }

    impl Release {
        fn new() -> Self {
            Self {
                platform: Platform::current(),
                dir: tempfile::tempdir().unwrap(),
                key: SigningKey::generate(&mut OsRng),
            }
        }

        fn publish(
            &self,
            version: &str,
            schema_version: u32,
            files: &[(&str, &[u8], &str)],
        ) -> Manifest {
            let entries: Vec<FileEntry> = files
                .iter()
                .map(|(path, content, mode)| FileEntry {
                    path: (*path).to_string(),
                    sha256: hash_bytes(content),
                    size: content.len() as u64,
                    mode: (*mode).to_string(),
                    link: None,
                })
                .collect();

            let manifest = Manifest {
                version: version.to_string(),
                min_shell: None,
                schema_version,
                entry: "run_server.mjs".to_string(),
                plugins: vec![],
                files: entries,
            };

            let json = serde_json::to_string(&manifest).unwrap();
            let signed = SignedManifest {
                signature: {
                    use base64::Engine;
                    base64::engine::general_purpose::STANDARD
                        .encode(self.key.sign(json.as_bytes()).to_bytes())
                },
                manifest: json,
            };

            let manifest_path = self
                .dir
                .path()
                .join(fetch::manifest_key(&self.platform, version));
            fs::create_dir_all(manifest_path.parent().unwrap()).unwrap();
            fs::write(&manifest_path, serde_json::to_vec(&signed).unwrap()).unwrap();

            for (_, content, _) in files {
                let hash = hash_bytes(content);
                let blob_path = self.dir.path().join(fetch::blob_key(&hash));
                fs::create_dir_all(blob_path.parent().unwrap()).unwrap();
                fs::write(&blob_path, zstd::stream::encode_all(*content, 3).unwrap()).unwrap();
            }

            manifest
        }

        fn publish_channel(&self, channel: &str, version: &str) {
            let path = self
                .dir
                .path()
                .join(fetch::channel_key(channel, &self.platform));
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(
                &path,
                serde_json::to_vec(&ChannelPointer {
                    channel: channel.to_string(),
                    version: version.to_string(),
                })
                .unwrap(),
            )
            .unwrap();
        }
    }

    fn installer_for<'a>(
        release: &Release,
        source: &'a DirSource,
        layout: Layout,
    ) -> Installer<'a> {
        Installer::new(layout, source, release.key.verifying_key())
    }

    fn silent() -> impl FnMut(Progress) {
        |_| {}
    }

    #[test]
    fn a_fresh_install_produces_a_complete_tree() {
        let release = Release::new();
        let manifest = release.publish(
            "1.9.0",
            1,
            &[
                ("run_server.mjs", b"console.log('server')", "0644"),
                ("bin/node", b"#!/bin/sh\necho node", "0755"),
            ],
        );
        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let layout = Layout::new(data.path());
        let installer = installer_for(&release, &source, layout.clone());

        let root = installer.ensure(&manifest, &mut silent()).unwrap();

        assert_eq!(
            fs::read(root.join("run_server.mjs")).unwrap(),
            b"console.log('server')"
        );
        assert_eq!(
            fs::read(root.join("bin/node")).unwrap(),
            b"#!/bin/sh\necho node"
        );
        installer.verify_tree(&manifest).unwrap();
    }

    #[test]
    fn a_channel_resolves_to_its_version() {
        let release = Release::new();
        release.publish("1.9.0", 1, &[("a", b"a", "0644")]);
        release.publish_channel("stable", "1.9.0");
        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let installer = installer_for(&release, &source, Layout::new(data.path()));

        assert_eq!(installer.resolve_channel("stable").unwrap(), "1.9.0");
    }

    #[test]
    fn a_manifest_signed_by_another_key_is_refused() {
        let release = Release::new();
        release.publish("1.9.0", 1, &[("a", b"a", "0644")]);
        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();

        let attacker = SigningKey::generate(&mut OsRng);
        let installer = Installer::new(Layout::new(data.path()), &source, attacker.verifying_key());

        let err = installer.fetch_manifest("1.9.0").unwrap_err().to_string();
        assert!(err.contains("signature does not verify"), "{err}");
    }

    #[test]
    fn a_corrupted_blob_fails_the_install_rather_than_landing() {
        let release = Release::new();
        let manifest = release.publish("1.9.0", 1, &[("a.js", b"genuine", "0644")]);

        // Swap the published blob for something else, leaving the signed
        // manifest (and therefore the expected hash) untouched.
        let hash = hash_bytes(b"genuine");
        let blob_path = release.dir.path().join(fetch::blob_key(&hash));
        fs::write(
            &blob_path,
            zstd::stream::encode_all(&b"malicious"[..], 3).unwrap(),
        )
        .unwrap();

        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let layout = Layout::new(data.path());
        let installer = installer_for(&release, &source, layout.clone());

        let err = installer
            .ensure(&manifest, &mut silent())
            .unwrap_err()
            .to_string();
        assert!(err.contains("failed verification"), "{err}");
        assert!(
            !layout.runtime_dir("1.9.0").exists(),
            "a failed install must not leave a runtime directory behind"
        );
    }

    #[test]
    fn an_update_only_downloads_what_changed() {
        let release = Release::new();
        let shared = b"a very large unchanging dependency".as_slice();
        let v1 = release.publish(
            "1.0.0",
            1,
            &[("node", shared, "0755"), ("app.js", b"v1", "0644")],
        );
        let v2 = release.publish(
            "1.1.0",
            1,
            &[("node", shared, "0755"), ("app.js", b"v2", "0644")],
        );

        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let layout = Layout::new(data.path());
        let installer = installer_for(&release, &source, layout.clone());

        installer.ensure(&v1, &mut silent()).unwrap();

        // Delete the shared blob from the CDN. If the update tried to
        // re-fetch it, this install would fail.
        let shared_hash = hash_bytes(shared);
        fs::remove_file(release.dir.path().join(fetch::blob_key(&shared_hash))).unwrap();

        let root = installer.ensure(&v2, &mut silent()).unwrap();
        assert_eq!(fs::read(root.join("node")).unwrap(), shared);
        assert_eq!(fs::read(root.join("app.js")).unwrap(), b"v2");
    }

    #[test]
    fn both_versions_stay_usable_after_an_update() {
        let release = Release::new();
        let v1 = release.publish("1.0.0", 1, &[("app.js", b"v1", "0644")]);
        let v2 = release.publish("1.1.0", 1, &[("app.js", b"v2", "0644")]);
        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let layout = Layout::new(data.path());
        let installer = installer_for(&release, &source, layout.clone());

        installer.ensure(&v1, &mut silent()).unwrap();
        installer.ensure(&v2, &mut silent()).unwrap();

        assert_eq!(
            fs::read(layout.runtime_dir("1.0.0").join("app.js")).unwrap(),
            b"v1",
            "the previous runtime must survive so rollback is possible"
        );
        assert_eq!(
            fs::read(layout.runtime_dir("1.1.0").join("app.js")).unwrap(),
            b"v2"
        );
    }

    #[test]
    fn activation_refuses_a_rollback_past_a_migration() {
        let release = Release::new();
        let old = release.publish("1.0.0", 6, &[("app.js", b"old", "0644")]);
        let new = release.publish("1.1.0", 7, &[("app.js", b"new", "0644")]);
        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let layout = Layout::new(data.path());
        let installer = installer_for(&release, &source, layout.clone());

        installer.ensure(&new, &mut silent()).unwrap();
        installer.activate(&new).unwrap();

        let mut state = CurrentState::load(&layout.current_file()).unwrap();
        state.record_migration(7);
        state.save(&layout.current_file()).unwrap();

        installer.ensure(&old, &mut silent()).unwrap();
        assert!(
            installer.activate(&old).is_err(),
            "activating a pre-migration runtime would lose data"
        );
    }

    #[test]
    fn reinstalling_an_intact_runtime_is_a_no_op() {
        let release = Release::new();
        let manifest = release.publish("1.9.0", 1, &[("app.js", b"x", "0644")]);
        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let layout = Layout::new(data.path());
        let installer = installer_for(&release, &source, layout.clone());

        installer.ensure(&manifest, &mut silent()).unwrap();
        let marker = layout.runtime_dir("1.9.0").join("app.js");
        let before = fs::metadata(&marker).unwrap().modified().unwrap();

        installer.ensure(&manifest, &mut silent()).unwrap();
        let after = fs::metadata(&marker).unwrap().modified().unwrap();
        assert_eq!(before, after, "an intact runtime must not be rebuilt");
    }

    #[test]
    fn a_damaged_runtime_is_repaired_on_the_next_ensure() {
        let release = Release::new();
        let manifest = release.publish("1.9.0", 1, &[("app.js", b"correct", "0644")]);
        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let layout = Layout::new(data.path());
        let installer = installer_for(&release, &source, layout.clone());

        installer.ensure(&manifest, &mut silent()).unwrap();

        let victim = layout.runtime_dir("1.9.0").join("app.js");
        link::set_tree_readonly(&layout.runtime_dir("1.9.0"), false);
        fs::write(&victim, b"truncated").unwrap();
        assert!(installer.verify_tree(&manifest).is_err());

        installer.ensure(&manifest, &mut silent()).unwrap();
        assert_eq!(fs::read(&victim).unwrap(), b"correct");
    }

    #[test]
    fn pruning_removes_old_runtimes_and_their_blobs() {
        let release = Release::new();
        let v1 = release.publish("1.0.0", 1, &[("app.js", b"v1-only", "0644")]);
        let v2 = release.publish("1.1.0", 1, &[("app.js", b"v2-only", "0644")]);
        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let layout = Layout::new(data.path());
        let installer = installer_for(&release, &source, layout.clone());

        installer.ensure(&v1, &mut silent()).unwrap();
        installer.ensure(&v2, &mut silent()).unwrap();

        installer.prune(&["1.1.0".to_string()]).unwrap();

        assert!(!layout.runtime_dir("1.0.0").exists());
        assert!(layout.runtime_dir("1.1.0").exists());
        let cas = Cas::new(layout.clone());
        assert!(!cas.has(&hash_bytes(b"v1-only")));
        assert!(cas.has(&hash_bytes(b"v2-only")));
    }

    #[test]
    fn a_full_pack_is_used_when_one_is_published() {
        let release = Release::new();
        let manifest = release.publish(
            "1.9.0",
            1,
            &[("a.js", b"alpha", "0644"), ("b.js", b"beta", "0644")],
        );

        // Build a full pack, then delete the individual blobs so the install
        // can only succeed through the pack.
        let mut tar_bytes = Vec::new();
        {
            let mut builder = tar::Builder::new(&mut tar_bytes);
            for content in [b"alpha".as_slice(), b"beta".as_slice()] {
                let hash = hash_bytes(content);
                let mut header = tar::Header::new_gnu();
                header.set_size(content.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder.append_data(&mut header, &hash, content).unwrap();
            }
            builder.finish().unwrap();
        }
        let pack_path = release
            .dir
            .path()
            .join(fetch::full_pack_key(&release.platform, "1.9.0"));
        fs::create_dir_all(pack_path.parent().unwrap()).unwrap();
        fs::write(
            &pack_path,
            zstd::stream::encode_all(&tar_bytes[..], 3).unwrap(),
        )
        .unwrap();

        for content in [b"alpha".as_slice(), b"beta".as_slice()] {
            fs::remove_file(
                release
                    .dir
                    .path()
                    .join(fetch::blob_key(&hash_bytes(content))),
            )
            .unwrap();
        }

        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let installer = installer_for(&release, &source, Layout::new(data.path()));

        let root = installer.ensure(&manifest, &mut silent()).unwrap();
        assert_eq!(fs::read(root.join("a.js")).unwrap(), b"alpha");
        assert_eq!(fs::read(root.join("b.js")).unwrap(), b"beta");
    }

    #[test]
    fn progress_reaches_completion() {
        let release = Release::new();
        let manifest = release.publish(
            "1.9.0",
            1,
            &[("a.js", b"a", "0644"), ("b.js", b"b", "0644")],
        );
        let source = DirSource::new(release.dir.path());
        let data = tempfile::tempdir().unwrap();
        let installer = installer_for(&release, &source, Layout::new(data.path()));

        let mut assembled = None;
        installer
            .ensure(&manifest, &mut |p| {
                if let Progress::Assemble { done, total } = p {
                    assembled = Some((done, total));
                }
            })
            .unwrap();

        assert_eq!(assembled, Some((2, 2)));
    }
}
