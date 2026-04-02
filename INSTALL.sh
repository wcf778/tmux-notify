#!/bin/bash
set -e

REPO="wcf778/tmux-notify"
INSTALL_DIR="$HOME/.config/opencode/plugins/tmux-notify"

echo "Installing tmux-notify plugin..."

mkdir -p "$INSTALL_DIR"

BASE_URL="https://raw.githubusercontent.com/${REPO}/main"

echo "Downloading tmux-notify.js..."
curl -fsSL "${BASE_URL}/tmux-notify.js" -o "$INSTALL_DIR/tmux-notify.js"

mkdir -p "$INSTALL_DIR/examples"
echo "Downloading helper scripts..."

for file in notification-viewer.sh tmux-bindings.conf tmux-adopt-notify clear-notifications.sh notification-status.sh; do
    echo "  - $file"
    curl -fsSL "${BASE_URL}/$file" -o "$INSTALL_DIR/examples/$file"
done

chmod +x "$INSTALL_DIR/examples"/*.sh 2>/dev/null || true

echo ""
echo "✓ tmux-notify installed to $INSTALL_DIR"
echo ""
echo "Next steps:"
echo "1. Restart opencode - plugin auto-loads"
echo "2. (Optional) Add to ~/.tmux.conf:"
echo "   source-file $INSTALL_DIR/examples/tmux-bindings.conf"
