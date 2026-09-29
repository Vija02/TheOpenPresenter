#!/bin/bash
# Fix chrome-sandbox permissions so Chromium's setuid sandbox works.
# Required because the deb is installed by a non-root-preserving extractor
# and the AppImage squashfs cannot keep the SUID bit at all.
set -e

# Must match `productName` in electron-builder.yml: that is what decides the
# /opt directory the package installs into. This script was copied from the
# screen app and kept pointing at /opt/TheOpenPresenterScreen, so the chmod
# silently did nothing here.
INSTALL_DIR="/opt/TheOpenPresenter"
SANDBOX="$INSTALL_DIR/chrome-sandbox"

if [ -f "$SANDBOX" ]; then
  chown root:root "$SANDBOX"
  chmod 4755 "$SANDBOX"
fi

exit 0
