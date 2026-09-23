// Compile the two platform-gated blocks from link.rs as ordinary Linux code,
// with the cfg conditions stripped. Neither block is ever type-checked on a
// Linux build, which is exactly how a u32/i32 mismatch and a missing import
// reached CI. This does not need cross-compilation or a C toolchain.
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

// ---- the macOS clonefile block, minus #[cfg(target_os = "macos")] --------
mod macos_shape {
    // Declared extern so the call site needs `unsafe`, exactly as the real
    // libc binding does. Never linked: this file is only type-checked.
    extern "C" {
        fn clonefile(src: *const i8, dst: *const i8, flags: u32) -> i32;
    }

    #[allow(dead_code)]
    pub fn try_reflink_macos(src: &std::path::Path, dest: &std::path::Path) -> bool {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;

        const CLONE_NOFOLLOW: u32 = 0x0001;

        let (Ok(src_c), Ok(dest_c)) = (
            CString::new(src.as_os_str().as_bytes()),
            CString::new(dest.as_os_str().as_bytes()),
        ) else {
            return false;
        };
        unsafe { clonefile(src_c.as_ptr(), dest_c.as_ptr(), CLONE_NOFOLLOW) == 0 }
    }
}

// ---- the Windows symlink fallback, minus #[cfg(not(unix))] --------------
#[allow(dead_code)]
fn place_symlink_windows(target: &str, dest: &Path) -> Result<()> {
    let resolved = dest
        .parent()
        .map(|p| p.join(target))
        .unwrap_or_else(|| PathBuf::from(target));
    if resolved.is_file() {
        fs::copy(&resolved, dest)
            .with_context(|| format!("Failed to copy {}", resolved.display()))?;
    }
    Ok(())
}

fn main() {
    println!("both platform blocks type-check");
}
