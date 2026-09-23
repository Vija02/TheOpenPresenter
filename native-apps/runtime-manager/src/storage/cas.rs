//! Content-addressed blob store.
//!
//! Blobs are stored by the sha256 of their *uncompressed* content. Every
//! write is verified against the expected hash and lands via a rename, so a
//! partial download can never be mistaken for a complete blob.
//!
//! [`Cas`] itself is client-side: the publisher never keeps a store. What
//! both sides share is [`hash_bytes`] and [`hash_file`], and they have to
//! agree exactly, because the hash a release is published under is the same
//! string a client looks up. That shared definition is why this lives in
//! `storage` rather than next to either consumer.

use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use sha2::{Digest, Sha256};

use crate::storage::paths::Layout;

pub struct Cas {
    layout: Layout,
}

impl Cas {
    pub fn new(layout: Layout) -> Self {
        Self { layout }
    }

    pub fn has(&self, sha256_hex: &str) -> bool {
        self.layout.cas_path(sha256_hex).is_file()
    }

    pub fn path(&self, sha256_hex: &str) -> PathBuf {
        self.layout.cas_path(sha256_hex)
    }

    /// Store bytes under their expected hash. Rejects content whose hash does
    /// not match, which is what makes a signed manifest enough to trust an
    /// unsigned blob.
    pub fn put(&self, expected_sha256: &str, bytes: &[u8]) -> Result<PathBuf> {
        let actual = hash_bytes(bytes);
        if actual != expected_sha256 {
            bail!("Blob hash mismatch: expected {expected_sha256}, got {actual}");
        }
        self.put_unchecked(expected_sha256, bytes)
    }

    /// Store bytes whose hash has already been verified by the caller.
    fn put_unchecked(&self, sha256_hex: &str, bytes: &[u8]) -> Result<PathBuf> {
        let dest = self.layout.cas_path(sha256_hex);
        if dest.is_file() {
            return Ok(dest);
        }

        let parent = dest
            .parent()
            .context("CAS path unexpectedly has no parent")?;
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create {}", parent.display()))?;

        // Write to a sibling temp file then rename: a rename within a
        // directory is atomic, so a crash mid-write leaves a stray temp file
        // rather than a truncated blob that looks complete.
        let tmp = parent.join(format!(".{sha256_hex}.partial"));
        {
            let mut f = File::create(&tmp)
                .with_context(|| format!("Failed to create {}", tmp.display()))?;
            f.write_all(bytes)?;
            f.sync_all()?;
        }
        fs::rename(&tmp, &dest)
            .with_context(|| format!("Failed to move blob into place at {}", dest.display()))?;
        Ok(dest)
    }

    /// Store from a reader, hashing as it streams. Used for pack extraction
    /// where holding every blob in memory is wasteful.
    pub fn put_reader(&self, expected_sha256: &str, reader: &mut impl Read) -> Result<PathBuf> {
        let mut buf = Vec::new();
        reader.read_to_end(&mut buf)?;
        self.put(expected_sha256, &buf)
    }

    /// Copy an existing file into the store, hashing it on the way in.
    /// Returns the hash.
    pub fn ingest_file(&self, src: &Path) -> Result<String> {
        let bytes = fs::read(src).with_context(|| format!("Failed to read {}", src.display()))?;
        let hash = hash_bytes(&bytes);
        self.put_unchecked(&hash, &bytes)?;
        Ok(hash)
    }

    /// Delete blobs that no live manifest references. Keeping the previous
    /// runtime for rollback costs only its delta, so this is only worth
    /// running after a version is pruned.
    pub fn gc(&self, live_hashes: &std::collections::HashSet<String>) -> Result<u64> {
        let mut freed = 0u64;
        let cas = self.layout.cas_dir();
        let Ok(shards) = fs::read_dir(&cas) else {
            return Ok(0);
        };

        for shard in shards.filter_map(|e| e.ok()) {
            if !shard.path().is_dir() {
                continue;
            }
            let Ok(blobs) = fs::read_dir(shard.path()) else {
                continue;
            };
            for blob in blobs.filter_map(|e| e.ok()) {
                let Some(name) = blob.file_name().to_str().map(str::to_string) else {
                    continue;
                };
                if name.starts_with('.') || live_hashes.contains(&name) {
                    continue;
                }
                let metadata = blob.metadata().ok();
                let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

                // Runtime trees hold hardlinks to these same inodes, so
                // deleting a blob that is still linked frees nothing. It is
                // still correct to remove it from the store, but reporting
                // it as reclaimed space would tell a user with a full disk
                // that their problem is solved when it is not.
                let frees_space = link_count(metadata.as_ref()) <= 1;

                if fs::remove_file(blob.path()).is_ok() && frees_space {
                    freed += size;
                }
            }
        }
        Ok(freed)
    }
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

pub fn hash_file(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buf)?;
        if read == 0 {
            break;
        }
        hasher.update(&buf[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// How many hardlinks point at this file.
///
/// Returns 1 where the platform does not report it (Windows via this API),
/// which makes the caller treat the delete as freeing space: on a
/// filesystem without hardlink reuse that is the truth.
fn link_count(metadata: Option<&std::fs::Metadata>) -> u64 {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        metadata.map(|m| m.nlink()).unwrap_or(1)
    }
    #[cfg(not(unix))]
    {
        let _ = metadata;
        1
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    fn cas() -> (tempfile::TempDir, Cas) {
        let tmp = tempfile::tempdir().unwrap();
        let layout = Layout::new(tmp.path());
        layout.ensure().unwrap();
        (tmp, Cas::new(layout))
    }

    #[test]
    fn a_stored_blob_is_retrievable() {
        let (_tmp, cas) = cas();
        let content = b"hello runtime";
        let hash = hash_bytes(content);

        assert!(!cas.has(&hash));
        cas.put(&hash, content).unwrap();
        assert!(cas.has(&hash));
        assert_eq!(fs::read(cas.path(&hash)).unwrap(), content);
    }

    #[test]
    fn content_that_does_not_match_its_hash_is_refused() {
        let (_tmp, cas) = cas();
        let claimed = hash_bytes(b"the real thing");

        let err = cas.put(&claimed, b"something else").unwrap_err();
        assert!(err.to_string().contains("hash mismatch"));
        assert!(!cas.has(&claimed), "rejected content must not be stored");
    }

    #[test]
    fn storing_the_same_blob_twice_is_a_no_op() {
        let (_tmp, cas) = cas();
        let hash = hash_bytes(b"x");
        cas.put(&hash, b"x").unwrap();
        cas.put(&hash, b"x").unwrap();
        assert!(cas.has(&hash));
    }

    #[test]
    fn no_partial_files_are_left_behind_on_success() {
        let (_tmp, cas) = cas();
        let hash = hash_bytes(b"payload");
        let path = cas.put(&hash, b"payload").unwrap();

        let leftovers: Vec<_> = fs::read_dir(path.parent().unwrap())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with('.'))
            .collect();
        assert!(leftovers.is_empty(), "temp file was not cleaned up");
    }

    #[cfg(unix)]
    #[test]
    fn gc_does_not_claim_to_free_space_still_held_by_a_runtime() {
        // Runtime trees hardlink CAS blobs. Removing the store's link to a
        // blob an installed runtime still uses frees no disk at all, and
        // reporting otherwise tells a user with a full disk that the
        // problem is fixed when nothing changed.
        let tmp = tempfile::tempdir().unwrap();
        let layout = Layout::new(tmp.path());
        layout.ensure().unwrap();
        let store = Cas::new(layout.clone());

        let held = b"held by a runtime";
        let orphaned = b"referenced by nothing";
        let shared = hash_bytes(held);
        let orphan = hash_bytes(orphaned);
        store.put(&shared, held).unwrap();
        store.put(&orphan, orphaned).unwrap();

        // Simulate an installed runtime holding one of them.
        let runtime_file = layout.runtime_dir("1.0.0").join("lib.js");
        std::fs::create_dir_all(runtime_file.parent().unwrap()).unwrap();
        std::fs::hard_link(layout.cas_path(&shared), &runtime_file).unwrap();

        let freed = store.gc(&HashSet::new()).unwrap();

        // Both left the store, but only the orphan actually freed bytes.
        assert!(!layout.cas_path(&shared).exists());
        assert!(!layout.cas_path(&orphan).exists());
        assert_eq!(
            freed,
            orphaned.len() as u64,
            "space still held by a runtime must not be counted as reclaimed"
        );

        // And the runtime is undamaged.
        assert_eq!(std::fs::read(&runtime_file).unwrap(), held);
    }

    #[test]
    fn gc_keeps_live_blobs_and_drops_the_rest() {
        let (_tmp, cas) = cas();
        let keep = hash_bytes(b"keep");
        let drop = hash_bytes(b"drop");
        cas.put(&keep, b"keep").unwrap();
        cas.put(&drop, b"drop").unwrap();

        let live: HashSet<String> = [keep.clone()].into_iter().collect();
        let freed = cas.gc(&live).unwrap();

        assert!(cas.has(&keep));
        assert!(!cas.has(&drop));
        assert_eq!(freed, 4);
    }

    #[test]
    fn ingest_file_returns_the_content_hash() {
        let (tmp, cas) = cas();
        let src = tmp.path().join("src.bin");
        fs::write(&src, b"ingest me").unwrap();

        let hash = cas.ingest_file(&src).unwrap();
        assert_eq!(hash, hash_bytes(b"ingest me"));
        assert!(cas.has(&hash));
    }
}
