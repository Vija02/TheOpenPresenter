//! Input devices.

use anyhow::Result;

/// EVIOCGRAB on the evdev device the app passed as fd 3, so its key presses
/// go only to the app. Exiting closes our copy of the fd, not the grab.
#[cfg(target_os = "linux")]
pub fn grab_input() -> Result<()> {
    const EVIOCGRAB: u64 = 0x4004_4590;
    let result = unsafe { libc::ioctl(3, EVIOCGRAB as _, 1 as libc::c_int) };
    if result != 0 {
        anyhow::bail!(
            "Could not grab the input device: {}",
            std::io::Error::last_os_error()
        );
    }
    Ok(())
}

#[cfg(not(target_os = "linux"))]
pub fn grab_input() -> Result<()> {
    anyhow::bail!("Grabbing input devices is only supported on Linux.")
}
