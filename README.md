# tmux-notify

Intelligent notification tracking for opencode agents. Works with or without tmux.

## Demo

![Demo](demo.png)

## Requirements

| Package | Version | Required | Description |
|---------|---------|----------|-------------|
| **opencode** | any with ES module support | Yes | Main application. Plugin auto-loads from `~/.config/opencode/plugins/` |
| **tmux** | ≥ 3.0 | No | Full tmux sidebar experience with popups and dedicated panes |
| **Ghostty** | any | No | Native tab title support (macOS terminal) |

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/wcf778/tmux-notify/main/install.sh | bash
```

After installation, add to `~/.tmux.conf`:
```bash
source-file ~/.config/opencode/plugins/tmux-notify/examples/tmux-bindings.conf
```

## Quick Start

### tmux Workflow

```bash
# Start workspace with notification sidebar
dev-workspace ~/Projects/myapp
```

### Terminal Workflow (no tmux)

```bash
# Terminal 1: Run opencode
opencode

# Terminal 2: Run notification viewer
notification-viewer.sh ~/Projects/myapp
```

## Keybindings

<details>
<summary>tmux Keybindings</summary>

| Key | Action |
|-----|--------|
| `Prefix + n` | Show notifications popup |
| `Prefix + M` | Add notification pane to current window |
| `Prefix + N` | Clear notification history |
| `Prefix + m` | Toggle between panes |

</details>

<details>
<summary>Ghostty Keybindings</summary>

| Key | Action |
|-----|--------|
| `Cmd+Shift+n` | Toggle notification pane |

Add to `~/.config/ghostty/config`:
```
bind = cmd+shift+n !exec ~/.config/opencode/plugins/examples/notification-viewer.sh
```

</details>

## Features

- **Per-project notifications** - Each project directory gets its own log file
- **Smart summarization** - Detects questions, suggestions, actions, and code responses
- **Rich metadata** - Shows tokens used, tool calls, and duration
- **macOS notifications** - System notifications via osascript
- **Session coloring** - Unique color per project for easy identification
- **tmux-optional** - Full functionality with tmux, graceful degradation without

## Output Format

```
04-02-2026 14:06:19 myapp ✅ 💡 plan 2 questions 46.1k tok · 90 tools · 2m 3s
```

### Status & Agent Emojis

| Emoji | Status | | Emoji | Agent |
|-------|--------|-|-------|-------|
| 💭 | thinking | | 🚀 | build |
| ✅ | done | | 💡 | plan |
| 🚨 | error | | 🔧 | debug |
| ⏳ | waiting | | 🧪 | test |

## Scripts

| Script | Description |
|--------|-------------|
| `notification-viewer.sh` | Display notifications in terminal pane |
| `tmux-adopt-notify` | Add notification pane to existing tmux session |
| `clear-notifications.sh` | Clear notification logs for a project |
| `notification-status.sh` | Show latest notification in tmux status bar |

## Smart Summarization

Detects and summarizes:
- Multi-choice questions → "N choices"
- Bullet/numbered lists → "N suggestions"
- Section headers → "N topics"
- Action verbs → "created: X", "fixed: Y"
- Code responses → "provided code"

Supports English, Chinese, and Japanese.

## Architecture

```
opencode session
    ├── tmux (if available)
    ├── Ghostty (if available)
    └── Log file (always)
         │
         ▼
    tmux-notify plugin
```

| Feature | tmux | Ghostty | Terminal |
|---------|------|---------|----------|
| Status display | ✅ | ✅ | ❌ |
| Notifications | ✅ | ✅ | ✅ |
| Sidebar | ✅ | ⚠️ | ⚠️ |
