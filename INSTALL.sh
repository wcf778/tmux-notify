#!/bin/bash
set -e

INSTALL_DIR="${HOME}/.config/opencode/plugins"
REPO_DIR="${HOME}/.config/opencode/plugins/tmux-notify"

echo "Installing tmux-notify plugin..."

mkdir -p "$INSTALL_DIR"

if [[ -d "$REPO_DIR/.git" ]]; then
    echo "Updating from git repository..."
    git -C "$REPO_DIR" pull origin main
else
    echo "Installing tmux-notify.js to ${INSTALL_DIR}/..."
    if [[ -f "${INSTALL_DIR}/tmux-notify.js" ]]; then
        cp "${INSTALL_DIR}/tmux-notify.js" "${INSTALL_DIR}/tmux-notify.js.bak"
        echo "Backed up existing tmux-notify.js to tmux-notify.js.bak"
    fi
    cp "$(dirname "$0")/tmux-notify.js" "${INSTALL_DIR}/"
fi

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Ensure your opencode plugins directory includes tmux-notify:"
echo "   - opencode should auto-load plugins from ~/.config/opencode/plugins/"
echo ""
echo "2. For tmux integration, add to ~/.tmux.conf:"
echo "   source-file ~/.config/opencode/plugins/examples/.tmux.conf.example"
echo ""
echo "3. For the notification sidebar, use dev-workspace:"
echo "   dev-workspace ~/Projects/myapp"
echo ""
echo "The plugin works WITHOUT tmux - it will use:"
echo "   - macOS notifications"
echo "   - Ghostty tab titles (if using Ghostty)"
echo "   - Log file in .opencode/ directory"
echo ""
