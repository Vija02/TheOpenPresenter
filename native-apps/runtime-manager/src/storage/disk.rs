//! Check free disk space and deciding whether an install will fit.

use std::path::Path;

use anyhow::{Context, Result};

pub const HEADROOM_BYTES: u64 = 512 * 1024 * 1024;

/// Warn when free space after install would be under this.
pub const COMFORTABLE_BYTES: u64 = 2 * 1024 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Fit {
    /// Plenty of room.
    Fine,
    /// It will fit, but leaves the machine uncomfortably full.
    Tight { free_after: u64 },
    /// Not enough room to install safely.
    TooSmall { needed: u64, available: u64 },
}

/// Bytes available to this user on the filesystem holding `path`
pub fn available_bytes(path: &Path) -> Result<u64> {
    let mut probe = path;
    loop {
        if probe.exists() {
            break;
        }
        match probe.parent() {
            Some(parent) => probe = parent,
            None => break,
        }
    }
    statvfs_available(probe)
}

/// Decide whether an install of `needed` bytes fits under `root`
pub fn check(root: &Path, needed: u64, already_held: u64) -> Result<Fit> {
    let available = available_bytes(root)?;
    let to_write = needed.saturating_sub(already_held);

    if available < to_write.saturating_add(HEADROOM_BYTES) {
        return Ok(Fit::TooSmall {
            needed: to_write.saturating_add(HEADROOM_BYTES),
            available,
        });
    }

    let free_after = available - to_write;
    if free_after < COMFORTABLE_BYTES {
        return Ok(Fit::Tight { free_after });
    }
    Ok(Fit::Fine)
}

/// Human readable
pub fn human(bytes: u64) -> String {
    const GB: f64 = 1024.0 * 1024.0 * 1024.0;
    const MB: f64 = 1024.0 * 1024.0;
    let bytes = bytes as f64;
    if bytes >= GB {
        format!("{:.1} GB", bytes / GB)
    } else {
        format!("{:.0} MB", bytes / MB)
    }
}

#[cfg(unix)]
fn statvfs_available(path: &Path) -> Result<u64> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let c_path =
        CString::new(path.as_os_str().as_bytes()).context("Path contains an interior NUL byte")?;

    // SAFETY: c_path is a valid NUL-terminated string that outlives the
    // call, and stats is written only on success.
    let mut stats: libc::statvfs = unsafe { std::mem::zeroed() };
    let rc = unsafe { libc::statvfs(c_path.as_ptr(), &mut stats) };
    if rc != 0 {
        return Err(std::io::Error::last_os_error())
            .with_context(|| format!("Could not read free space for {}", path.display()));
    }

    // f_bavail, not f_bfree: the latter includes blocks reserved for root,
    // which this process cannot use and must not promise the user.
    Ok(stats.f_bavail as u64 * stats.f_frsize as u64)
}

#[cfg(windows)]
fn statvfs_available(path: &Path) -> Result<u64> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut free_to_caller: u64 = 0;
    // SAFETY: wide is NUL-terminated and outlives the call; the out
    // parameter is a valid pointer to owned storage.
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_to_caller,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        return Err(std::io::Error::last_os_error())
            .with_context(|| format!("Could not read free space for {}", path.display()));
    }
    Ok(free_to_caller)
}

#[cfg(not(any(unix, windows)))]
fn statvfs_available(_path: &Path) -> Result<u64> {
    anyhow::bail!("Free space is not available on this platform")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_real_free_space_for_an_existing_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let available = available_bytes(tmp.path()).unwrap();
        assert!(
            available > 0,
            "a writable temp dir should report free space"
        );
    }

    #[test]
    fn a_root_that_does_not_exist_yet_still_reports_space() {
        // First run: the install root has never been created. Failing here
        // would block the very first install on every machine.
        let tmp = tempfile::tempdir().unwrap();
        let unborn = tmp.path().join("does/not/exist/yet");
        assert!(available_bytes(&unborn).unwrap() > 0);
    }

    #[test]
    fn an_impossible_install_is_refused() {
        let tmp = tempfile::tempdir().unwrap();
        let fit = check(tmp.path(), u64::MAX / 2, 0).unwrap();
        assert!(matches!(fit, Fit::TooSmall { .. }), "got {fit:?}");
    }

    #[test]
    fn a_small_install_is_fine() {
        let tmp = tempfile::tempdir().unwrap();
        assert_eq!(check(tmp.path(), 1024, 0).unwrap(), Fit::Fine);
    }

    #[test]
    fn blobs_already_held_do_not_count_against_the_budget() {
        // An update that reuses almost everything writes almost nothing.
        // Charging it the full release size would refuse updates on a
        // machine that has ample room for the actual delta.
        let tmp = tempfile::tempdir().unwrap();
        let huge = available_bytes(tmp.path()).unwrap() + 100 * 1024 * 1024 * 1024;

        assert!(matches!(
            check(tmp.path(), huge, 0).unwrap(),
            Fit::TooSmall { .. }
        ));
        assert_eq!(
            check(tmp.path(), huge, huge).unwrap(),
            Fit::Fine,
            "a release we already hold entirely needs no new space"
        );
    }

    #[test]
    fn sizes_read_the_way_a_person_would_say_them() {
        assert_eq!(human(500 * 1024 * 1024), "500 MB");
        assert_eq!(human(2 * 1024 * 1024 * 1024), "2.0 GB");
    }
}
