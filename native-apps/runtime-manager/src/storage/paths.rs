//! On-disk layout of everything
//!
//! ```text
//! <root>/
//!   versions/1.9.0/     installed runtimes, read-only after assembly
//!   data/               IRREPLACEABLE. The user's work.
//!     db/               PostgreSQL cluster
//!     uploads/          media they imported
//!   cache/              safe to delete; costs a re-download
//!     blobs/ab/ab12…    content-addressed file store
//!     staging/          partially assembled runtimes
//!   logs/               diagnostic output, rotated
//!   config.json         active version, rollback bookkeeping, settings
//! ```
//!
//! Version directories are named for the version they hold

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

/// Folder name used under the OS data dir when no explicit root is given.
pub const APP_DATA_FOLDER: &str = "TheOpenPresenter";

#[derive(Debug, Clone)]
pub struct Layout {
    root: PathBuf,
    /// The caller named this location rather than letting us pick it.
    ///
    /// Adoption is skipped for these: asking for a specific directory is
    /// a deliberate act, and a test or a second instance that asks for an
    /// empty one should not silently receive a copy of someone's data.
    explicit: bool,
}

impl Layout {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            root: root.into(),
            explicit: true,
        }
    }

    /// Resolve the default root: `TOP_RUNTIME_ROOT` if set, otherwise the
    /// platform data directory.
    ///
    /// This lands in the conventional per-user data location on each OS
    /// (`~/.local/share`, `~/Library/Application Support`, `%APPDATA%`)
    pub fn discover() -> Result<Self> {
        if let Some(explicit) = std::env::var_os("TOP_RUNTIME_ROOT") {
            return Ok(Self::new(PathBuf::from(explicit)));
        }

        let dirs = directories::BaseDirs::new()
            .context("Could not resolve a home directory for this user")?;
        Ok(Self {
            root: dirs.data_dir().join(APP_DATA_FOLDER),
            explicit: false,
        })
    }

    /// Where the shipped Tauri app keeps its database and uploads.
    /// For backwards compatibility.
    pub fn tauri_data_dir() -> Option<PathBuf> {
        let dirs = directories::BaseDirs::new()?;
        Some(dirs.data_dir().join("theopenpresenter"))
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    // -- Installed runtimes ---------------------------------------------

    pub fn runtimes_dir(&self) -> PathBuf {
        self.root.join("versions")
    }

    pub fn runtime_dir(&self, version: &str) -> PathBuf {
        self.runtimes_dir().join(version)
    }

    /// Where an installed version's verified manifest is kept.
    ///
    /// Inside the version directory, so removing a runtime removes its
    /// manifest with it and the two cannot drift apart.
    pub fn manifest_file(&self, version: &str) -> PathBuf {
        self.runtime_dir(version).join(".manifest.json")
    }

    // -- Cache: deletable, costs only a re-download ----------------------

    pub fn cache_dir(&self) -> PathBuf {
        self.root.join("cache")
    }

    pub fn cas_dir(&self) -> PathBuf {
        self.cache_dir().join("blobs")
    }

    /// Blobs are sharded by the first two hex characters: a flat directory
    /// of tens of thousands of entries is slow to list on every platform
    /// and pathological on some Windows filesystems.
    pub fn cas_path(&self, sha256_hex: &str) -> PathBuf {
        let shard = &sha256_hex[..2.min(sha256_hex.len())];
        self.cas_dir().join(shard).join(sha256_hex)
    }

    /// Staging for in-progress assembly. Inside the cache because a
    /// half-assembled runtime is worth exactly nothing after a crash.
    pub fn tmp_dir(&self) -> PathBuf {
        self.cache_dir().join("staging")
    }

    // -- User data: irreplaceable ----------------------------------------

    pub fn state_dir(&self) -> PathBuf {
        self.root.join("data")
    }

    pub fn pgdata_dir(&self) -> PathBuf {
        self.state_dir().join("db")
    }

    pub fn uploads_dir(&self) -> PathBuf {
        self.state_dir().join("uploads")
    }

    pub fn env_file(&self) -> PathBuf {
        self.state_dir().join(".env")
    }

    // -- Diagnostics and bookkeeping -------------------------------------

    /// Logs sit at the root rather than under `data/`: they are not the
    /// user's work, but deleting them while debugging is unhelpful, so
    /// they are not cache either.
    pub fn logs_dir(&self) -> PathBuf {
        self.root.join("logs")
    }

    pub fn current_file(&self) -> PathBuf {
        self.root.join("config.json")
    }

    /// Bring a Tauri install's data across, so upgrading keeps your work.
    pub fn adopt_tauri_data(&self) -> Result<Option<PathBuf>> {
        if self.explicit {
            return Ok(None);
        }
        let Some(previous) = Self::tauri_data_dir() else {
            return Ok(None);
        };
        // On macOS and Windows both apps resolve to the same directory,
        // in which case the data is already where it belongs.
        if previous == self.root {
            return Ok(None);
        }
        Ok(copy_from(self, &previous)?.then_some(previous))
    }

    /// Create every directory the manager expects to exist.
    pub fn ensure(&self) -> Result<()> {
        for dir in [
            self.root.clone(),
            self.runtimes_dir(),
            self.cas_dir(),
            self.state_dir(),
            self.uploads_dir(),
            self.logs_dir(),
            self.tmp_dir(),
        ] {
            std::fs::create_dir_all(&dir)
                .with_context(|| format!("Failed to create {}", dir.display()))?;
        }
        Ok(())
    }

    /// Versions currently installed, as directory names.
    pub fn installed_versions(&self) -> Vec<String> {
        let Ok(entries) = std::fs::read_dir(self.runtimes_dir()) else {
            return Vec::new();
        };
        let mut out: Vec<String> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .filter_map(|e| e.file_name().into_string().ok())
            .collect();
        out.sort();
        out
    }
}

/// Copy another install's user data into `layout`, if there is any to take.
///
/// Split out from [`Layout::adopt_tauri_data`] so it can be tested against
/// a temporary directory rather than whatever is in the real home folder.
/// Returns whether anything was copied.
fn copy_from(layout: &Layout, previous: &Path) -> Result<bool> {
    // Anything already here means this is not a fresh install, so there is
    // nothing to seed and merging is not on the table.
    if layout.pgdata_dir().exists() || layout.uploads_dir().exists() {
        return Ok(false);
    }
    if !previous.join("db").is_dir() {
        return Ok(false);
    }

    std::fs::create_dir_all(layout.state_dir())?;
    copy_dir(&previous.join("db"), &layout.pgdata_dir())
        .with_context(|| format!("Failed to copy the database from {}", previous.display()))?;

    let uploads = previous.join("uploads");
    if uploads.is_dir() {
        copy_dir(&uploads, &layout.uploads_dir())?;
    }
    let env = previous.join(".env");
    if env.is_file() {
        std::fs::copy(&env, layout.env_file())?;
    }
    Ok(true)
}

/// Recursively copy a directory
fn copy_dir(from: &Path, to: &Path) -> Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else if kind.is_file() {
            std::fs::copy(entry.path(), &target)?;
        }
        // Symlinks are skipped: a PostgreSQL data directory has none, and
        // following one out of the tree would copy something unrelated.
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_is_outside_every_runtime_dir() {
        let layout = Layout::new("/data");
        let state = layout.state_dir();
        for version in ["1.8.3", "1.9.0"] {
            assert!(
                !state.starts_with(layout.runtime_dir(version)),
                "state must never live inside a runtime directory"
            );
        }
    }

    #[test]
    fn cas_paths_are_sharded_by_hash_prefix() {
        let layout = Layout::new("/data");
        let path = layout.cas_path("ab12cd34");
        assert!(path.ends_with("ab/ab12cd34"));
    }

    #[test]
    fn ensure_creates_the_whole_tree() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = Layout::new(tmp.path());
        layout.ensure().unwrap();
        assert!(layout.cas_dir().is_dir());
        assert!(layout.uploads_dir().is_dir());
        assert!(layout.logs_dir().is_dir());
    }

    #[test]
    fn tauri_data_is_copied_not_moved() {
        // The Tauri app may still be installed and opened again. Taking
        // its database away to seed a new install is not a trade anyone
        // agreed to, so the original has to survive intact.
        let tmp = tempfile::tempdir().unwrap();
        let previous = tmp.path().join("theopenpresenter");
        std::fs::create_dir_all(previous.join("db/base")).unwrap();
        std::fs::create_dir_all(previous.join("uploads")).unwrap();
        std::fs::write(previous.join("db/PG_VERSION"), b"16").unwrap();
        std::fs::write(previous.join("db/base/1"), b"pages").unwrap();
        std::fs::write(previous.join("uploads/sermon.mp4"), b"video").unwrap();
        std::fs::write(previous.join(".env"), b"SECRET=x\n").unwrap();

        let layout = Layout::new(tmp.path().join("TheOpenPresenter"));
        let adopted = copy_from(&layout, &previous).unwrap();
        assert!(adopted, "a Tauri install should be adopted");

        assert_eq!(
            std::fs::read(layout.pgdata_dir().join("PG_VERSION")).unwrap(),
            b"16"
        );
        assert_eq!(
            std::fs::read(layout.pgdata_dir().join("base/1")).unwrap(),
            b"pages"
        );
        assert_eq!(
            std::fs::read(layout.uploads_dir().join("sermon.mp4")).unwrap(),
            b"video"
        );
        assert!(layout.env_file().is_file());

        // The source is untouched.
        assert!(previous.join("db/PG_VERSION").is_file());
        assert!(previous.join("uploads/sermon.mp4").is_file());
    }

    #[test]
    fn an_existing_database_is_never_overwritten() {
        // Someone who has already used this app has the real data here.
        // Copying an older Tauri database over it would silently roll
        // their work back.
        let tmp = tempfile::tempdir().unwrap();
        let previous = tmp.path().join("theopenpresenter");
        std::fs::create_dir_all(previous.join("db")).unwrap();
        std::fs::write(previous.join("db/PG_VERSION"), b"old").unwrap();

        let layout = Layout::new(tmp.path().join("TheOpenPresenter"));
        std::fs::create_dir_all(layout.pgdata_dir()).unwrap();
        std::fs::write(layout.pgdata_dir().join("PG_VERSION"), b"mine").unwrap();

        assert!(!copy_from(&layout, &previous).unwrap());
        assert_eq!(
            std::fs::read(layout.pgdata_dir().join("PG_VERSION")).unwrap(),
            b"mine"
        );
    }

    #[test]
    fn nothing_happens_without_a_tauri_install() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = Layout::new(tmp.path().join("TheOpenPresenter"));
        let missing = tmp.path().join("theopenpresenter");
        assert!(!copy_from(&layout, &missing).unwrap());
        assert!(!layout.pgdata_dir().exists());
    }

    #[test]
    fn an_explicit_root_is_never_seeded() {
        // Tests and second instances ask for a specific empty directory.
        // Silently filling it with a copy of someone's database would be
        // both surprising and expensive.
        let tmp = tempfile::tempdir().unwrap();
        let layout = Layout::new(tmp.path().join("chosen"));
        assert_eq!(layout.adopt_tauri_data().unwrap(), None);
        assert!(!layout.pgdata_dir().exists());
    }

    #[test]
    fn user_data_is_never_inside_the_cache() {
        // The cache is documented as safe to delete. If user data were
        // under it, that advice would destroy the user's work.
        let layout = Layout::new("/data");
        for path in [
            layout.state_dir(),
            layout.pgdata_dir(),
            layout.uploads_dir(),
        ] {
            assert!(
                !path.starts_with(layout.cache_dir()),
                "{} must not live under the cache",
                path.display()
            );
        }
    }

    #[test]
    fn everything_deletable_is_under_the_cache() {
        // The converse: anything the manager treats as reclaimable must be
        // inside cache/, or "delete cache/ to free space" leaves the bulk
        // of the disk usage behind and the advice is useless.
        let layout = Layout::new("/data");
        for path in [layout.cas_dir(), layout.tmp_dir()] {
            assert!(
                path.starts_with(layout.cache_dir()),
                "{} should be reclaimable",
                path.display()
            );
        }
    }

    #[test]
    fn installed_versions_lists_runtime_dirs() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = Layout::new(tmp.path());
        layout.ensure().unwrap();
        std::fs::create_dir_all(layout.runtime_dir("1.9.0")).unwrap();
        std::fs::create_dir_all(layout.runtime_dir("1.8.3")).unwrap();
        assert_eq!(layout.installed_versions(), vec!["1.8.3", "1.9.0"]);
    }
}
