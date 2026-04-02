#!/bin/bash
# notification-status - Show latest notification in tmux status bar
# Usage: Add to tmux status-right: set -g status-right "#(notification-status)"

LOG_FILE=$(ls -t ~/.tmux-notify-*.log 2>/dev/null | head -1)

if [[ -f "$LOG_FILE" ]]; then
    # Extract just the summary from the latest line
    LATEST=$(tail -1 "$LOG_FILE" 2>/dev/null | sed 's/.*[✅💭🚨⏳💤🛑] [^ ]* [^ ]* //' | cut -d'·' -f1 | tr -d '\n' | cut -c1-40)
    if [[ -n "$LATEST" ]]; then
        echo "$LATEST"
    else
        echo "..."
    fi
else
    echo "..."
fi