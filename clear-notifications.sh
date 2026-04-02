#!/bin/bash
# clear-notifications - Clear notification history for current project
# Usage: clear-notifications [project-dir]
# Can be bound to a key in tmux, Ghostty, or any terminal

PROJECT_DIR="${1:-$(pwd)}"
LOG_DIR="${PROJECT_DIR}/.opencode"

clear_notifications() {
    local project="${1:-$(pwd)}"
    local log_dir="${project}/.opencode"
    
    if [[ ! -d "$log_dir" ]]; then
        echo "No .opencode directory found in $project"
        return 1
    fi
    
    # Find and clear all notification logs
    local cleared=0
    for f in "$log_dir"/notifications-*.log; do
        if [[ -f "$f" ]]; then
            > "$f"
            echo "Cleared: $(basename "$f")"
            ((cleared++))
        fi
    done
    
    if (( cleared == 0 )); then
        echo "No notification logs found to clear"
        return 1
    fi
    
    echo "Cleared $cleared notification log(s)"
    
    # Also clear symlinks if they exist
    for symlink in "$HOME"/.tmux-notify-*.log; do
        if [[ -L "$symlink" ]]; then
            rm -f "$symlink"
            echo "Removed symlink: $(basename "$symlink")"
        fi
    done
}

# If run directly, execute clear
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    clear_notifications "$PROJECT_DIR"
fi
