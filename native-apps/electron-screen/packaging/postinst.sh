#!/bin/bash
# Fix chrome-sandbox permissions so Chromium's setuid sandbox works.
# Required because the deb is installed by a non-root-preserving extractor
# and the AppImage squashfs cannot keep the SUID bit at all.
set -e

INSTALL_DIR="/opt/TheOpenPresenterScreen"
SANDBOX="$INSTALL_DIR/chrome-sandbox"

if [ -f "$SANDBOX" ]; then
  chown root:root "$SANDBOX"
  chmod 4755 "$SANDBOX"
fi

exit 0
