//! Persistent activation state: which runtime is current, which is known
//! good, and what the database schema has already been migrated to.
//!
//! Two rules live here, and they are the reliability difference between this
//! and re-shipping the whole bundle:
//!
//! 1. **Rollback is bounded by migration state, not version number.** Once a
//!    runtime has migrated the database, activating an older runtime that
//!    cannot read that schema is data loss, so it is refused.
//! 2. **A runtime that crashes on startup reverts.** Repeated early exits
//!    increment a counter; at the threshold the manager goes back to the last
//!    version that actually ran.

use std::fs;
use std::path::Path;

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};

/// Consecutive early crashes tolerated before reverting.
pub const CRASH_THRESHOLD: u32 = 3;

/// A runtime that survives this long counts as a successful start.
pub const SETTLE_SECONDS: u64 = 60;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct CurrentState {
    /// Version the shell should launch.
    pub current: Option<String>,
    /// Most recent version that started and stayed up past the settle window.
    pub last_good: Option<String>,
    /// Highest schema version any runtime has migrated this database to.
    #[serde(default)]
    pub migrated_schema_version: u32,
    /// Consecutive early exits of `current` since its last good start.
    #[serde(default)]
    pub crash_count: u32,
}

impl CurrentState {
    pub fn load(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let text = fs::read_to_string(path)
            .with_context(|| format!("Failed to read {}", path.display()))?;
        // A corrupt pointer file must not brick the install: treat it as a
        // fresh state and let `ensure` rebuild it.
        Ok(serde_json::from_str(&text).unwrap_or_default())
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let tmp = path.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_vec_pretty(self)?)?;
        fs::rename(&tmp, path).with_context(|| format!("Failed to update {}", path.display()))?;
        Ok(())
    }

    /// Whether activating a runtime with this schema version is safe.
    ///
    /// Equal is fine (same schema), newer is fine (it will migrate forward).
    /// Older is refused, because the database has already moved past what it
    /// understands.
    pub fn can_activate(&self, schema_version: u32) -> bool {
        schema_version >= self.migrated_schema_version
    }

    pub fn activate(&mut self, version: &str, schema_version: u32) -> Result<()> {
        if !self.can_activate(schema_version) {
            bail!(
                "Refusing to activate runtime {version}: it expects schema version \
                 {schema_version} but the database has already been migrated to \
                 {}. Rolling back past a migration would lose data.",
                self.migrated_schema_version
            );
        }
        self.current = Some(version.to_string());
        self.crash_count = 0;
        Ok(())
    }

    /// Record that the active runtime migrated the database.
    pub fn record_migration(&mut self, schema_version: u32) {
        self.migrated_schema_version = self.migrated_schema_version.max(schema_version);
    }

    /// The active runtime stayed up past the settle window.
    pub fn mark_good(&mut self) {
        self.last_good = self.current.clone();
        self.crash_count = 0;
    }

    /// The active runtime exited early. Returns the version to revert to once
    /// the threshold is reached, if there is a different one to go back to.
    pub fn record_crash(&mut self) -> Option<String> {
        self.crash_count += 1;
        if self.crash_count < CRASH_THRESHOLD {
            return None;
        }
        match (&self.last_good, &self.current) {
            (Some(good), Some(cur)) if good != cur => Some(good.clone()),
            _ => None,
        }
    }

    /// Revert to `version` after repeated crashes. Deliberately skips the
    /// schema check: the same check already ran when the crashing version was
    /// activated, and refusing to revert would leave the user with an app
    /// that does not start at all.
    pub fn revert_to(&mut self, version: &str) {
        self.current = Some(version.to_string());
        self.crash_count = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_pointer_file_reads_as_empty_state() {
        let tmp = tempfile::tempdir().unwrap();
        let state = CurrentState::load(&tmp.path().join("current.json")).unwrap();
        assert_eq!(state, CurrentState::default());
    }

    #[test]
    fn a_corrupt_pointer_file_does_not_brick_the_install() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("current.json");
        fs::write(&path, b"{ this is not json").unwrap();

        let state = CurrentState::load(&path).unwrap();
        assert_eq!(state, CurrentState::default());
    }

    #[test]
    fn state_survives_a_save_load_round_trip() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("current.json");

        let mut state = CurrentState::default();
        state.activate("1.9.0", 7).unwrap();
        state.record_migration(7);
        state.mark_good();
        state.save(&path).unwrap();

        let loaded = CurrentState::load(&path).unwrap();
        assert_eq!(loaded.current.as_deref(), Some("1.9.0"));
        assert_eq!(loaded.last_good.as_deref(), Some("1.9.0"));
        assert_eq!(loaded.migrated_schema_version, 7);
    }

    #[test]
    fn rolling_back_past_a_migration_is_refused() {
        let mut state = CurrentState::default();
        state.activate("1.9.0", 7).unwrap();
        state.record_migration(7);

        let err = state.activate("1.8.3", 6).unwrap_err().to_string();
        assert!(err.contains("Refusing to activate"), "{err}");
        assert_eq!(
            state.current.as_deref(),
            Some("1.9.0"),
            "a refused activation must not change the pointer"
        );
    }

    #[test]
    fn rolling_back_within_the_same_schema_is_allowed() {
        let mut state = CurrentState::default();
        state.activate("1.9.0", 7).unwrap();
        state.record_migration(7);

        // 1.8.9 shipped no migrations, so it reads the same schema.
        state.activate("1.8.9", 7).unwrap();
        assert_eq!(state.current.as_deref(), Some("1.8.9"));
    }

    #[test]
    fn upgrading_to_a_newer_schema_is_allowed() {
        let mut state = CurrentState::default();
        state.activate("1.9.0", 7).unwrap();
        state.record_migration(7);
        state.activate("2.0.0", 9).unwrap();
        assert_eq!(state.current.as_deref(), Some("2.0.0"));
    }

    #[test]
    fn migration_version_never_goes_backwards() {
        let mut state = CurrentState::default();
        state.record_migration(7);
        state.record_migration(3);
        assert_eq!(state.migrated_schema_version, 7);
    }

    #[test]
    fn repeated_early_crashes_revert_to_the_last_good_version() {
        let mut state = CurrentState::default();
        state.activate("1.8.3", 6).unwrap();
        state.mark_good();
        state.activate("1.9.0", 7).unwrap();

        assert_eq!(state.record_crash(), None);
        assert_eq!(state.record_crash(), None);
        assert_eq!(state.record_crash(), Some("1.8.3".to_string()));

        state.revert_to("1.8.3");
        assert_eq!(state.current.as_deref(), Some("1.8.3"));
        assert_eq!(state.crash_count, 0);
    }

    #[test]
    fn crashes_do_not_revert_when_there_is_nowhere_to_go() {
        let mut state = CurrentState::default();
        state.activate("1.9.0", 7).unwrap();
        state.mark_good();

        for _ in 0..(CRASH_THRESHOLD + 2) {
            assert_eq!(
                state.record_crash(),
                None,
                "reverting to the same version would just crash again"
            );
        }
    }

    #[test]
    fn a_good_start_clears_the_crash_counter() {
        let mut state = CurrentState::default();
        state.activate("1.9.0", 7).unwrap();
        state.record_crash();
        state.record_crash();
        state.mark_good();
        assert_eq!(state.crash_count, 0);
        assert_eq!(state.record_crash(), None);
    }
}
