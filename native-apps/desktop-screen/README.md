# TheOpenPresenter Screen (desktop)

Turn any desktop, mini-PC, or Linux SBC (Raspberry Pi 4/5 etc.) into a
kiosk display for TheOpenPresenter. Pair it once via QR, pick which
screen it should be, and it boots straight into a fullscreen render of
your content every time.

## Features

- **Fullscreen kiosk** on the monitor you choose. No window chrome.
- **Autostart on login** — registers itself with the OS so the device
  comes up into the kiosk after every reboot.
- **"Wait for host" boot gate** — if your network or server is slower
  than the kiosk on cold boot, the kiosk holds off launching until the
  server responds. Polls every 5 seconds; Settings shows a status
  banner while it waits.
- **Multi-monitor aware** — pick which physical display the kiosk
  lives on. The pick survives restarts and close → re-open cycles.
- **Tray icon** — open Settings, show/hide the screen, or quit at any
  time.
- **Esc to escape** — press Esc while the kiosk has focus to hide it
  back to the tray. Works on X11, Wayland, macOS, and Windows.
- **Live audio mute** (Linux / Windows) — silence the kiosk without
  hiding it. The kiosk is always muted while hidden regardless.
- **QR sign-in** — no typing credentials on the kiosk itself. Scan a QR
  with your phone, sign in there, pair the device.

## Install

### Linux (x86_64, aarch64)

Tested on Debian / Ubuntu, Fedora / RHEL / CentOS, Arch, openSUSE.

```sh
curl -fsSL https://theopenpresenter.com/install.sh | bash
```

The script:
1. Installs the system libraries the kiosk webview needs
   (`webkit2gtk-4.1`, `gtk3`, `libsoup-3.0`, `libayatana-appindicator3`,
   GStreamer + plugins) via your distro's package manager. Uses `sudo`
   if you're not root.
2. Downloads the `theopenpresenter` binary into `~/.local/bin/`.
3. Drops a launcher in `~/.local/share/applications/` so it shows up
   in your app menu.

Run again any time to update — it's idempotent.

### macOS / Windows

Not currently published. The Linux binary is the supported path right
now.

## First-run setup

1. Launch the app — type `theopenpresenter` in a terminal, or open it
   from your app launcher. The Settings window appears with a QR code.
2. Scan the QR with your phone, sign in.
3. Pick which screen this device should display.
4. (Optional) Open the **Where to show** dropdown in Settings and pick
   a specific monitor. The kiosk jumps there fullscreen.
5. (Optional) Tick **Only start when host is reachable** if your
   network or server might be slow on boot.

From then on, the device reboots → kiosk comes up fullscreen on the
right monitor automatically. Autostart is enabled by default after the
first launch; flip it off in Settings if you'd rather launch the kiosk
manually.

## Settings reference

Open Settings from the tray icon, or just relaunch `theopenpresenter` —
a second invocation focuses the running instance's Settings window.

Every control applies immediately. There's no Save button.

- **Status** — current server URL, reachability, and the paired screen.
- **Screen window** — Open / Close / Refresh the kiosk window; mute /
  unmute audio (Linux / Windows only).
- **Where to show** — pick the monitor the kiosk opens on, or leave at
  "Current monitor (don't move)".
- **Start automatically on login** — autostart toggle.
- **Only start when host is reachable** — gate the autostart launch on
  a successful network probe.
- **Change screen** — re-pair to a different screen on the same
  account without signing out.
- **Sign out** — clear the session and return to the QR login.

## Where settings live

Everything the app remembers — server URL, paired screen, your
Settings choices — lives in one file under your OS's app-data
directory:

| OS | Path |
|---|---|
| Linux | `~/.local/share/com.theopenpresenter.desktop/config.json` |
| macOS | `~/Library/Application Support/com.theopenpresenter.desktop/config.json` |
| Windows | `%APPDATA%\com.theopenpresenter.desktop\config.json` |

- **Reset** the device fully: delete that file. You'll re-pair on next
  launch.
- **Clone** a configured device: copy the file over to the new
  machine after installing.

The session cookie lives in the webview's native cookie store separate
from `config.json`, so deleting the config doesn't sign you out — only
the **Sign out** button does.

## Troubleshooting

**Stuck fullscreen, Esc doesn't work** — you're on an older build
without the Wayland-compatible Esc handler. Kill it from another
terminal:

```sh
pkill -f desktop-screen
```

Then re-run the installer to pick up the current version.

**The kiosk shows on the wrong monitor** — open Settings, pick the
right monitor under **Where to show**. The pick is re-applied on every
show, so close + re-open the kiosk to land on the chosen display.

**It launches before the network is ready** — turn on **Only start
when host is reachable** in Settings. The next boot will wait until
your server responds before opening the kiosk.

**Need to point at a self-hosted server** — Settings → **Change
server** lets you type any URL. The default is
`https://theopenpresenter.com`.
