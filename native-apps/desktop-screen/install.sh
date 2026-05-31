#!/usr/bin/env bash
#
# TheOpenPresenter Screen — kiosk installer.
#
#   curl -fsSL https://theopenpresenter.com/install.sh | bash
#
# What this does:
#   1. Installs the system libraries the kiosk webview needs (webkit2gtk-4.1,
#      gtk3, libsoup-3.0, gnutls, ayatana-appindicator3, gstreamer + plugins)
#      via the native package manager. Sudo is used if you aren't root.
#   2. Downloads the `theopenpresenter` binary into ~/.local/bin/.
#   3. Adds a .desktop launcher into ~/.local/share/applications/ so it
#      shows up in your app launcher / menu.
#
# Launch-on-login is owned by the app itself: the first run enables
# autostart by default; you can flip it off in Settings any time.
#
# Run again any time to update. The install is idempotent.
#
# Once installed: type `theopenpresenter` in a terminal to open Settings.
# (The app uses a tray icon; subsequent `theopenpresenter` invocations
# focus the Settings window on the already-running instance.)

set -euo pipefail

# ---------------------------------------------------------------------------
# Config (overridable via env)
# ---------------------------------------------------------------------------
APP_NAME="theopenpresenter"
DISPLAY_NAME="TheOpenPresenter Screen"
DESCRIPTION="Kiosk screen for TheOpenPresenter"
ICON_URL="${TOP_ICON_URL:-https://raw.githubusercontent.com/vija02/theopenpresenter/main/native-apps/desktop-screen/src-tauri/icons/icon.png}"
# BIN_URL is constructed after arch detection below so the default tracks
# `uname -m`. Set TOP_BIN_URL to override entirely.

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      sed -n '3,22p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg (use --help)" >&2
      exit 2
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Sanity / detection
# ---------------------------------------------------------------------------
if [ "$(uname -s)" != "Linux" ]; then
  echo "This installer supports Linux only. Got: $(uname -s)" >&2
  exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  arch_tag="x86_64" ;;
  aarch64) arch_tag="aarch64" ;;
  *)
    echo "Unsupported architecture: $ARCH. Published builds: x86_64, aarch64." >&2
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Offer reinstall / uninstall.
# ---------------------------------------------------------------------------
if [ -e "$HOME/.local/bin/$APP_NAME" ]; then
  __have_tty=0
  if exec 3</dev/tty 2>/dev/null; then
    __have_tty=1
  fi

  __action="r"
  if [ "$__have_tty" = "1" ]; then
    echo ""
    echo "$DISPLAY_NAME is already installed."
    echo "  (R)einstall - overwrite the binary + launcher, leave app data alone"
    echo "  (U)ninstall - remove the binary + launcher (optionally app data too)"
    echo "  (Q)uit"
    printf "Choice [R/u/q]: "
    read -r __action <&3 || __action="r"
    echo ""
  fi

  case "${__action}" in
    [Uu]*)
      echo "Uninstalling..."
      rm -f "$HOME/.local/bin/$APP_NAME"
      rm -f "$HOME/.local/share/applications/$APP_NAME.desktop"
      rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/$APP_NAME.png"
      if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database -q "$HOME/.local/share/applications" 2>/dev/null || true
      fi

      __purge="n"
      if [ "$__have_tty" = "1" ]; then
        echo ""
        echo "Removed the installer's files. Would you like to remove app data?"
        printf "Remove that too? [y/N]: "
        read -r __purge <&3 || __purge="n"
        echo ""
      fi
      case "${__purge}" in
        [Yy]*)
          rm -rf "$HOME/.local/share/com.theopenpresenter.desktop"
          rm -rf "$HOME/.cache/com.theopenpresenter.desktop"
          find "$HOME/.config/autostart" -maxdepth 1 \
            \( -iname "*theopenpresenter*.desktop" -o -iname "*desktop-screen*.desktop" \) \
            -delete 2>/dev/null || true
          echo "Removed app data + autostart entries."
          ;;
      esac

      [ "$__have_tty" = "1" ] && exec 3<&-
      echo "Uninstalled $DISPLAY_NAME."
      exit 0
      ;;
    [Qq]*)
      [ "$__have_tty" = "1" ] && exec 3<&-
      echo "Aborted."
      exit 0
      ;;
    *)
      # Reinstall (default) — fall through to the install flow below.
      [ "$__have_tty" = "1" ] && exec 3<&-
      echo "Reinstalling..."
      ;;
  esac
fi

# Resolve the most recent `vX.Y.Z` tag from the GitHub Releases API. The
# repo uses a unified `v*` tag scheme — see `tagging.md`. We could use
# `/releases/latest/download/...` but going through the API lets us skip
# nightly/prerelease tags and any non-version tags an operator might push.
# Returns non-zero if the API is unreachable, rate-limited, or returns
# no matching tag.
resolve_latest_kiosk_tag() {
  local body
  if ! body=$(curl -fsSL --proto '=https' --tlsv1.2 \
      -H 'Accept: application/vnd.github+json' \
      "https://api.github.com/repos/vija02/theopenpresenter/releases?per_page=100" \
      2>/dev/null); then
    return 1
  fi
  # GitHub returns releases sorted by created_at descending; the first
  # matching `tag_name` is the most recent release. Pattern matches
  # `vN[.N[.N…]][-suffix]` so beta / rc tags work too.
  local tag
  tag=$(printf '%s' "$body" \
    | grep -oE '"tag_name"[[:space:]]*:[[:space:]]*"v[0-9][^"]*"' \
    | head -n 1 \
    | sed -E 's/.*"(v[0-9][^"]*)".*/\1/')
  [ -n "$tag" ] || return 1
  printf '%s' "$tag"
}

if [ -n "${TOP_BIN_URL:-}" ]; then
  BIN_URL="$TOP_BIN_URL"
else
  echo "Resolving latest kiosk release from GitHub..."
  if ! KIOSK_TAG=$(resolve_latest_kiosk_tag); then
    echo "Could not find a desktop-screen-v* release. Either the GitHub" >&2
    echo "API is unreachable, no kiosk release has been published yet, or" >&2
    echo "rate-limiting is in effect. Set TOP_BIN_URL=https://... to pin a" >&2
    echo "specific download URL and try again." >&2
    exit 1
  fi
  echo "  using ${KIOSK_TAG}"
  BIN_URL="https://github.com/vija02/theopenpresenter/releases/download/${KIOSK_TAG}/desktop-screen-linux-${arch_tag}"
fi

if [ ! -r /etc/os-release ]; then
  echo "Cannot detect distro (no readable /etc/os-release)." >&2
  exit 1
fi
. /etc/os-release

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

# ---------------------------------------------------------------------------
# Step 1 — system dependencies
# ---------------------------------------------------------------------------
echo "[1/3] Installing system dependencies..."

# Compose a distro key from ID and ID_LIKE so derivatives match.
distro_key="${ID:-} ${ID_LIKE:-}"
case "$distro_key" in
  *debian*|*ubuntu*)
    $SUDO apt-get update -y
    $SUDO apt-get install -y \
      libwebkit2gtk-4.1-0 libgtk-3-0 libsoup-3.0-0 libgnutls30 \
      libayatana-appindicator3-1 \
      gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
      gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
      gstreamer1.0-libav gstreamer1.0-vaapi \
      curl ca-certificates
    ;;
  *fedora*|*rhel*|*centos*)
    $SUDO dnf install -y \
      webkit2gtk4.1 gtk3 libsoup3 gnutls \
      libayatana-appindicator-gtk3 \
      gstreamer1-plugins-base gstreamer1-plugins-good \
      gstreamer1-plugins-bad-free gstreamer1-plugins-ugly \
      gstreamer1-libav gstreamer1-vaapi \
      curl ca-certificates
    ;;
  *arch*)
    $SUDO pacman -Syu --noconfirm --needed \
      webkit2gtk-4.1 gtk3 libsoup3 gnutls \
      libayatana-appindicator \
      gst-plugins-base gst-plugins-good \
      gst-plugins-bad gst-plugins-ugly \
      gst-libav gstreamer-vaapi \
      curl ca-certificates
    ;;
  *suse*|*opensuse*)
    $SUDO zypper --non-interactive install \
      libwebkit2gtk-4_1-0 libgtk-3-0 libsoup-3_0-0 libgnutls30 \
      libayatana-appindicator3-1 \
      gstreamer-plugins-base gstreamer-plugins-good \
      gstreamer-plugins-bad gstreamer-plugins-ugly \
      gstreamer-plugins-libav gstreamer-plugins-vaapi \
      curl ca-certificates
    ;;
  *)
    echo ""
    echo "WARNING: unrecognized distro ($ID). Install these manually first:"
    echo "  webkit2gtk-4.1, gtk3, libsoup-3.0, gnutls,"
    echo "  libayatana-appindicator3 (for the tray icon),"
    echo "  gstreamer + plugins-base / plugins-good / libav"
    echo ""
    read -rp "Skip dep install and continue? [y/N] " yn
    case "$yn" in [Yy]*) ;; *) exit 1 ;; esac
    ;;
esac

# ---------------------------------------------------------------------------
# Step 2 — download the binary
# ---------------------------------------------------------------------------
echo "[2/3] Downloading $APP_NAME..."

BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
curl -fSL --proto '=https' --tlsv1.2 "$BIN_URL" -o "$tmp"
install -m 0755 "$tmp" "$BIN_DIR/$APP_NAME"

# ---------------------------------------------------------------------------
# Step 3 — launcher + icon
# ---------------------------------------------------------------------------
echo "[3/3] Installing launcher..."

APP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
mkdir -p "$APP_DIR" "$ICON_DIR"

# Best-effort icon fetch. If it fails, the launcher falls back to a generic
# icon — non-fatal.
icon_line=""
if curl -fsSL "$ICON_URL" -o "$ICON_DIR/$APP_NAME.png" 2>/dev/null; then
  icon_line="Icon=$APP_NAME"
fi

cat > "$APP_DIR/$APP_NAME.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$DISPLAY_NAME
GenericName=Kiosk Screen
Comment=$DESCRIPTION
Exec=$BIN_DIR/$APP_NAME
${icon_line}
Terminal=false
Categories=Utility;Network;Presentation;
StartupNotify=true
StartupWMClass=$APP_NAME
EOF

# Refresh the desktop database if available so the launcher picks it up
# without a re-login. Failures are non-fatal.
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q "$APP_DIR" 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Done. PATH check + summary.
#
# (Autostart is handled by the app: the first run registers itself with the
# OS via `tauri-plugin-autostart`. Toggle it in Settings any time.)
# ---------------------------------------------------------------------------
echo ""
case ":${PATH:-}:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo "NOTE: $BIN_DIR is not on your PATH. Add this line to your shell rc"
    echo "      (~/.bashrc, ~/.zshrc) so the \`$APP_NAME\` command works in a"
    echo "      new shell:"
    echo ""
    echo "      export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    ;;
esac

echo "Installed $DISPLAY_NAME."
echo "  binary:    $BIN_DIR/$APP_NAME"
echo "  launcher:  $APP_DIR/$APP_NAME.desktop"
echo ""
echo "Run it:"
echo "  $APP_NAME"
