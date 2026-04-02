# Changelog

All notable changes to the tmux-notify project.

## [Current] - Core Plugin Files

### tmux-notify.js
**Status:** Main plugin  
**Added:** Initial commit  
**Description:** ES module plugin for opencode. Provides intelligent notification tracking with per-project logs, macOS notifications, tmux/Ghostty integration, and smart message summarization.

### notification-viewer.sh
**Status:** Core utility  
**Added:** Initial commit  
**Description:** Terminal-based notification viewer. Displays live notification logs in any terminal pane (Ghostty, iTerm, kitty). Supports session filtering, latest-only mode, and graceful exit.

## [Current] - tmux Integration

### tmux-bindings.conf
**Status:** tmux integration  
**Added:** Initial commit  
**Description:** tmux keybinding configuration. Source this file in `~/.tmux.conf` to enable: `Prefix+M` (add pane), `Prefix+n` (popup), `Prefix+N` (clear), `Prefix+m` (toggle).

### tmux-adopt-notify
**Status:** tmux integration  
**Added:** Initial commit  
**Description:** Script to add a notification sidebar to any existing tmux session. Run manually or bind to a key. Creates a split pane without disturbing your workflow.

## [Current] - Utilities

### clear-notifications.sh
**Status:** Utility  
**Added:** Initial commit  
**Description:** Clears all notification logs in a project's `.opencode/` directory and removes related symlinks. Use for fresh starts.

### notification-status.sh
**Status:** Utility  
**Added:** Initial commit  
**Description:** tmux status bar widget. Add `#{pipe(...)}` or `run-shell` to show latest notification summary in tmux's status-right.

### INSTALL.sh
**Status:** Setup  
**Added:** Initial commit  
**Description:** Installation script. Copies plugin to `~/.config/opencode/plugins/`. Handles backup of existing files.

## [Current] - Documentation

### README.md
**Status:** Documentation  
**Added:** Initial commit  
**Updated:** Multiple times  
**Description:** Main documentation. Contains features, requirements, installation, usage guides, architecture, and troubleshooting.

### FILE_DESCRIPTIONS.md
**Status:** Documentation  
**Added:** 2043202 (repo organization)  
**Description:** Quick reference guide explaining each file's purpose and unique functionality.

---

## Commit History

### e885ff0 - Initial commit
**Files added:** tmux-notify.js, notification-viewer.sh, tmux-adopt-notify, tmux-bindings.conf, clear-notifications.sh, notification-status.sh, INSTALL.sh, README.md  
**Summary:** Initial release with per-project notification logs, rich metadata, colored output, smart summarization, tmux sidebar support, and Ghostty tab titles.

### 9e1e801 - Remove publishing checklist
**Files modified:** README.md  
**Summary:** Removed internal publishing checklist from README.

### cfe2a44 - Restructure README
**Files modified:** README.md  
**Summary:** Reorganized README with Requirements section at top, added Workflow A (tmux) and Workflow B (terminal-only) as collapsible dropdowns.

### 2043202 - Organize repo
**Files removed:** ghostty-notify, ghostty-notify-toggle, ghostty.config.example  
**Files added:** FILE_DESCRIPTIONS.md  
**Files modified:** README.md  
**Summary:** Removed obsolete Ghostty scripts (non-working API), added FILE_DESCRIPTIONS.md for file reference, updated Requirements section with package versions.

---

## Removed Files

### ghostty-notify (removed in 2043202)
**Reason:** Deprecated Ghostty API, functionality covered by notification-viewer.sh

### ghostty-notify-toggle (removed in 2043202)
**Reason:** osascript Ghostty API doesn't work, functionality covered by notification-viewer.sh

### ghostty.config.example (removed in 2043202)
**Reason:** Now documented in README.md

### .tmux.conf.example (removed in 2043202)
**Reason:** Now in tmux-bindings.conf
