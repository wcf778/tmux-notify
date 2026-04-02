#!/bin/bash
# notification-viewer - Display opencode notifications in any terminal pane
# Works with: Ghostty, iTerm, tmux, kitty, any terminal
# Usage: notification-viewer [project-dir] [--session SESSION_ID]
#        notification-viewer --latest   # show most recent notification only

PROJECT_DIR="${1:-$(pwd)}"
SESSION_FILTER="${SESSION_FILTER:-}"
WINDOW_ID="${WINDOW_ID:-$$}"
TAIL_MODE="${TAIL_MODE:-false}"
SHOW_LATEST_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --latest|-l)
            SHOW_LATEST_ONLY=true
            shift
            ;;
        --session)
            SESSION_FILTER="$2"
            shift 2
            ;;
        *)
            PROJECT_DIR="$1"
            shift
            ;;
    esac
done

# Don't clear screen on exit - leave content visible
cleanup() {
    printf "\033[0m"
}
trap cleanup EXIT

get_log_file() {
    local project="$1"
    local log_dir="${project}/.opencode"
    
    if [[ ! -d "$log_dir" ]]; then
        return 1
    fi
    
    local latest_file=""
    local latest_mtime=0
    
    # Build glob pattern - if session filter provided, use it
    local glob_pattern="${log_dir}"/notifications-*.log
    if [[ -n "$SESSION_FILTER" ]]; then
        glob_pattern="${log_dir}"/notifications-*"${SESSION_FILTER}"*.log
    fi
    
    for f in $glob_pattern; do
        if [[ -f "$f" ]]; then
            local mtime=$(stat -f%m "$f" 2>/dev/null || stat -c%Y "$f" 2>/dev/null || echo 0)
            if (( mtime > latest_mtime )); then
                latest_mtime=$mtime
                latest_file="$f"
            fi
        fi
    done
    
    if [[ -n "$latest_file" ]]; then
        echo "$latest_file"
        return 0
    fi
    return 1
}

render_lines() {
    local log_file="$1"
    local count="${2:-30}"
    tail -n "$count" "$log_file" 2>/dev/null
}

print_header() {
    printf "\033[2J\033[H"
    printf "\033[1;36m📋 Notifications\033[0m · \033[33m%s\033[0m" "$(basename "$PROJECT_DIR")"
    [[ -n "$SESSION_FILTER" ]] && printf " \033[90m[%s]\033[0m" "$SESSION_FILTER"
    printf "\n"
    printf "\033[90m───────────────────────────────────────────────────────────────\033[0m\n"
}

LAST_SIZE=0
INITIALIZED=false

# Initial draw - only clear once at start
print_header
printf "\033[90mWaiting for notifications...\033[0m\n"
printf "\033[90mProject: %s\033[0m\n" "$PROJECT_DIR"
printf "\033[90mLog: %s/.opencode/notifications-*.log\033[0m\n" "$PROJECT_DIR"

while true; do
    # Check for exit signal
    [[ -f "/tmp/notification-viewer-exit" ]] && break
    
    log_file=$(get_log_file "$PROJECT_DIR" 2>/dev/null)
    
    if [[ -n "$log_file" && -f "$log_file" ]]; then
        current_size=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null || echo 0)
        
        if (( current_size != LAST_SIZE )); then
            print_header
            if [[ "$SHOW_LATEST_ONLY" == "true" ]]; then
                render_lines "$log_file" 1
            else
                render_lines "$log_file" 30
            fi
            LAST_SIZE=$current_size
            INITIALIZED=true
        fi
    fi
    
    sleep 1
done

cleanup
