# tmux-notify

Intelligent notification tracking for opencode agents. Works with or without tmux.

## Demo

![Demo](demo.png)

## Requirements

- **opencode** - ES module support
- **tmux** ≥ 3.0 (optional) - Full sidebar experience

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/wcf778/tmux-notify/main/install.sh | bash
```

## Quick Start

**tmux workflow:**
```bash
# Add bindings to ~/.tmux.conf
source-file ~/.config/opencode/plugins/tmux-notify/examples/tmux-bindings.conf

# Start workspace
dev-workspace ~/Projects/myapp
```

**Terminal-only workflow:**
```bash
# Terminal 1: opencode
opencode

# Terminal 2: notification viewer
notification-viewer.sh ~/Projects/myapp
```

## Keybindings (tmux)

| Key | Action |
|-----|--------|
| `Prefix + n` | Show notifications popup |
| `Prefix + M` | Add notification pane |
| `Prefix + N` | Clear notifications |
| `Prefix + m` | Toggle panes |

## Features

- Per-project notification logs
- Rich metadata (tokens, tools, duration)
- Smart summarization (questions, actions, code)
- macOS native notifications
- Session coloring for easy identification

## Files

| File | Description |
|------|-------------|
| `tmux-notify.js` | Core plugin |
| `notification-viewer.sh` | Terminal notification display |
| `tmux-bindings.conf` | tmux keybindings |
| `tmux-adopt-notify` | Add pane to existing session |
| `clear-notifications.sh` | Clear notification logs |
| `INSTALL.sh` | Installation script |
