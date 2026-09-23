//! Materialising CAS blobs into a runtime tree.
//!
//! Shared blobs are the reason runtime directories are read-only: an in-place
//! write to a hardlinked file would corrupt that file for every version
//! sharing it. Reflinks avoid the hazard entirely (copy-on-write gives the
//! same space saving without aliasing), so they are preferred where the
//! filesystem supports them.
//!
//! Order: reflink -> hardlink -> copy. On Windows hardlinks work on NTFS but
//! not across volumes, so the copy fallback is a real path, not a theoretical
//! one.

use std::fs;
use std::path::Path;
// Only the non-unix symlink fallback needs this, and an unconditional
// import would be an unused-import warning on Linux and macOS.
#[cfg(not(unix))]
use std::path::PathBuf;

use anyhow::{Context, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinkMethod {
    Reflink,
    Hardlink,
    Copy,
}

/// Place the blob at `src` into the runtime tree at `dest`.
pub fn place(src: &Path, dest: &Path, executable: bool) -> Result<LinkMethod> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create {}", parent.display()))?;
    }
    if dest.exists() {
        fs::remove_file(dest).ok();
    }

    let method = if try_reflink(src, dest) {
        LinkMethod::Reflink
    } else if !executable && fs::hard_link(src, dest).is_ok() {
        // Executables deliberately skip the hardlink path.
        LinkMethod::Hardlink
    } else {
        fs::copy(src, dest).with_context(|| {
            format!(
                "Failed to place {} at {} (reflink, hardlink and copy all failed)",
                src.display(),
                dest.display()
            )
        })?;
        LinkMethod::Copy
    };

    // Reflinks and copies own their inode, so the mode is theirs to set.
    // Hardlinks are only taken for non-executables, which need no change.
    if executable && method != LinkMethod::Hardlink {
        set_executable(dest)?;
    }

    Ok(method)
}

#[cfg(target_os = "linux")]
fn try_reflink(src: &Path, dest: &Path) -> bool {
    use std::os::unix::io::AsRawFd;

    // FICLONE: _IOW(0x94, 9, int)
    const FICLONE: libc::c_ulong = 0x40049409;

    let Ok(src_file) = fs::File::open(src) else {
        return false;
    };
    let Ok(dest_file) = fs::File::create(dest) else {
        return false;
    };

    // SAFETY: both descriptors are open and owned by this scope; FICLONE only
    // reads the source and writes the destination's extents.
    let result = unsafe { libc::ioctl(dest_file.as_raw_fd(), FICLONE, src_file.as_raw_fd()) };

    if result != 0 {
        drop(dest_file);
        fs::remove_file(dest).ok();
        return false;
    }
    true
}

#[cfg(target_os = "macos")]
fn try_reflink(src: &Path, dest: &Path) -> bool {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    const CLONE_NOFOLLOW: u32 = 0x0001;

    let (Ok(src_c), Ok(dest_c)) = (
        CString::new(src.as_os_str().as_bytes()),
        CString::new(dest.as_os_str().as_bytes()),
    ) else {
        return false;
    };

    // SAFETY: both paths are valid NUL-terminated C strings for the duration
    // of the call.
    unsafe { libc::clonefile(src_c.as_ptr(), dest_c.as_ptr(), CLONE_NOFOLLOW) == 0 }
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
fn try_reflink(_src: &Path, _dest: &Path) -> bool {
    false
}

#[cfg(unix)]
fn set_executable(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut perms = fs::metadata(path)?.permissions();
    perms.set_mode(perms.mode() | 0o755);
    fs::set_permissions(path, perms)?;
    Ok(())
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> Result<()> {
    Ok(())
}

/// Create a symlink at `dest` pointing at the relative `target`.
///
/// On Windows, creating a symlink needs admin rights or developer mode, so
/// the target is copied instead. That costs a little space and loses the
/// aliasing, but a runtime that installs everywhere beats one that needs
/// elevation.
pub fn place_symlink(target: &str, dest: &Path) -> Result<()> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create {}", parent.display()))?;
    }
    if dest.exists() || fs::symlink_metadata(dest).is_ok() {
        fs::remove_file(dest).ok();
    }

    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target, dest)
            .with_context(|| format!("Failed to link {} -> {target}", dest.display()))
    }

    #[cfg(not(unix))]
    {
        let resolved = dest
            .parent()
            .map(|p| p.join(target))
            .unwrap_or_else(|| PathBuf::from(target));
        if resolved.is_file() {
            fs::copy(&resolved, dest).with_context(|| {
                format!(
                    "Failed to copy {} in place of a symlink",
                    resolved.display()
                )
            })?;
        }
        Ok(())
    }
}

/// Mark a whole runtime tree read-only after assembly.
///
/// Best-effort: a filesystem that refuses the chmod is not a reason to fail
/// an otherwise complete install, and the read-only bit is defense in depth
pub fn set_tree_readonly(root: &Path, readonly: bool) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_dir() {
            set_tree_readonly(&path, readonly);
        } else if let Ok(meta) = fs::metadata(&path) {
            let mut perms = meta.permissions();
            perms.set_readonly(readonly);
            fs::set_permissions(&path, perms).ok();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(unix)]
    fn an_executable_is_runnable_and_does_not_taint_the_blob() {
        // The bug this pins: a hardlink shares the CAS blob's inode, so
        // chmod was skipped to avoid changing every runtime at once. The
        // result was a correct-looking tree whose binaries could not run.
        use std::os::unix::fs::PermissionsExt;

        let tmp = tempfile::tempdir().unwrap();
        let blob = tmp.path().join("blob");
        std::fs::write(&blob, b"#!/bin/sh\necho hi\n").unwrap();
        std::fs::set_permissions(&blob, std::fs::Permissions::from_mode(0o644)).unwrap();

        let dest = tmp.path().join("tree/bin/tool");
        place(&blob, &dest, true).unwrap();

        let placed = std::fs::metadata(&dest).unwrap().permissions().mode();
        assert!(
            placed & 0o111 != 0,
            "placed executable is not runnable: {placed:o}"
        );

        // The blob it came from keeps its own mode.
        let source = std::fs::metadata(&blob).unwrap().permissions().mode();
        assert_eq!(
            source & 0o111,
            0,
            "placing an executable changed the shared blob"
        );
    }

    #[test]
    fn placing_a_blob_reproduces_its_content() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("blob");
        let dest = tmp.path().join("nested/deep/file.js");
        fs::write(&src, b"console.log(1)").unwrap();

        place(&src, &dest, false).unwrap();

        assert_eq!(fs::read(&dest).unwrap(), b"console.log(1)");
    }

    #[test]
    fn placing_over_an_existing_file_replaces_it() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("blob");
        let dest = tmp.path().join("file");
        fs::write(&src, b"new").unwrap();
        fs::write(&dest, b"old").unwrap();

        place(&src, &dest, false).unwrap();

        assert_eq!(fs::read(&dest).unwrap(), b"new");
    }

    #[cfg(unix)]
    #[test]
    fn an_executable_placement_is_runnable() {
        use std::os::unix::fs::PermissionsExt;

        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("blob");
        let dest = tmp.path().join("bin/node");
        fs::write(&src, b"#!/bin/sh\n").unwrap();

        let method = place(&src, &dest, true).unwrap();

        // A hardlink shares the source inode, so we deliberately do not chmod
        // in that case; the mode then comes from the CAS blob.
        if method != LinkMethod::Hardlink {
            let mode = fs::metadata(&dest).unwrap().permissions().mode();
            assert!(
                mode & 0o111 != 0,
                "expected the executable bit, got {mode:o}"
            );
        }
    }

    #[test]
    fn read_only_can_be_applied_and_lifted() {
        let tmp = tempfile::tempdir().unwrap();
        let file = tmp.path().join("sub/f.txt");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, b"x").unwrap();

        set_tree_readonly(tmp.path(), true);
        assert!(fs::metadata(&file).unwrap().permissions().readonly());

        // Lifting it again must work, or a version could never be pruned.
        set_tree_readonly(tmp.path(), false);
        assert!(!fs::metadata(&file).unwrap().permissions().readonly());
    }
}
