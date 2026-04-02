# File Descriptions

## Core Files

| File | Description |
|------|-------------|
| `tmux-notify.js` | **Main plugin** - ES module for opencode. Tracks agent sessions, writes colored notifications to per-project log files, sends macOS notifications, updates Ghostty tab titles, and manages tmux status display. |
| `notification-viewer.sh` | **Notification display** - Terminal script that displays live notification logs. Works in any terminal (Ghostty, iTerm, kitty). Supports filtering by session, latest-only mode, and graceful exit. |

## tmux Integration

| File | Description |
|------|-------------|
| `tmux-bindings.conf` | **tmux keybindings** - Source this file in `~/.tmux.conf` to enable shortcut keys: `Prefix+M` (add notification pane), `Prefix+n` (popup), `Prefix+N` (clear), `Prefix+m` (toggle pane). |
| `tmux-adopt-notify` | **Add to existing session** - Script to add a notification sidebar pane to any running tmux session without disrupting your workflow. Run manually or bind to a key. |

## Utilities

| File | Description |
|------|-------------|
| `clear-notifications.sh` | **Clear logs** - Removes all notification logs in a project's `.opencode/` directory and cleans up symlinks. Useful for fresh starts. |
| `notification-status.sh` | **tmux status bar** - Add to tmux `status-right` to show latest notification summary inline. Output: `...` if no notifications. |

## Setup

| File | Description |
|------|-------------|
| `INSTALL.sh` | **Installation script** - Copies plugin to `~/.config/opencode/plugins/`. Run once after cloning. Handles backup of existing files. |

## Documentation

| File | Description |
|------|-------------|
| `README.md` | **Main documentation** - Full usage guide, architecture diagram, feature matrix, configuration options, and troubleshooting. |
