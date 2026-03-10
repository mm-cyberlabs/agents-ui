#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ─── Resolve the real script location (follows symlinks) ─────────────────────
SOURCE="${BASH_SOURCE[0]}"
while [[ -L "$SOURCE" ]]; do
    DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
    SOURCE="$(readlink "$SOURCE")"
    [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"

PORT="${AGENTS_UI_PORT:-40110}"

# ─── Parse arguments ─────────────────────────────────────────────────────────
COMMAND="${1:-start}"
shift 2>/dev/null || true

# Parse --port flag from remaining args
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Also handle: agents-ui --port 40110 (before the command)
# Re-parse if first arg was a flag
if [[ "$COMMAND" == "-p" || "$COMMAND" == "--port" ]]; then
    PORT="${1:-$PORT}"
    COMMAND="${2:-start}"
fi

# ─── Commands ─────────────────────────────────────────────────────────────────

ensure_server() {
    # Check if server is already running on the target port
    if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
        return 0
    fi

    echo -e "  ${DIM}Starting background server on port ${PORT}...${RESET}"
    cd "$SCRIPT_DIR"
    nohup node packages/cli/dist/index.js serve --port "$PORT" >/dev/null 2>&1 &
    SERVER_PID=$!

    # Wait up to 5 seconds for the server to be ready
    for i in $(seq 1 50); do
        if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
            return 0
        fi
        sleep 0.1
    done

    echo -e "  ${RED}Server failed to start${RESET}"
    return 1
}

cmd_start() {
    echo -e "${CYAN}${BOLD}agents-ui${RESET} ${DIM}— starting on port ${PORT}${RESET}"
    ensure_server
    cd "$SCRIPT_DIR"
    exec node packages/cli/dist/index.js start --port "$PORT"
}

cmd_web() {
    echo -e "${CYAN}${BOLD}agents-ui${RESET} ${DIM}— starting web UI on port ${PORT}${RESET}"
    ensure_server
    cd "$SCRIPT_DIR"
    exec node packages/cli/dist/index.js web --port "$PORT"
}

cmd_uninstall() {
    echo ""
    echo -e "${BOLD}${YELLOW}Uninstalling agents-ui${RESET}"
    echo ""

    # Step 1: Remove hooks from settings.json
    echo -e "  ${CYAN}→${RESET} Removing Claude Code hooks..."
    SETTINGS_FILE="$HOME/.claude/settings.json"
    HOOKS_BASE_URL="http://localhost:${PORT}"

    if [[ -f "$SETTINGS_FILE" ]]; then
        CLEANED=$(python3 -c "
import json, sys

with open('${SETTINGS_FILE}') as f:
    settings = json.load(f)

hooks = settings.get('hooks', {})
base_url = '${HOOKS_BASE_URL}'

for event in list(hooks.keys()):
    entries = hooks[event]
    if not isinstance(entries, list):
        continue

    filtered = []
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get('hooks'), list):
            filtered.append(entry)
            continue
        entry['hooks'] = [
            h for h in entry['hooks']
            if not (h.get('type') == 'http' and isinstance(h.get('url', ''), str) and h['url'].startswith(base_url))
        ]
        if entry['hooks']:
            filtered.append(entry)

    if filtered:
        hooks[event] = filtered
    else:
        del hooks[event]

settings['hooks'] = hooks
print(json.dumps(settings, indent=2))
" 2>/dev/null) && echo "$CLEANED" > "$SETTINGS_FILE"
        echo -e "  ${GREEN}✓${RESET} Hooks removed from ~/.claude/settings.json"
    else
        echo -e "  ${DIM}  No settings.json found, skipping${RESET}"
    fi

    # Step 2: Remove symlink
    echo -e "  ${CYAN}→${RESET} Removing agents-ui command..."
    SYMLINK="/usr/local/bin/agents-ui"
    if [[ -L "$SYMLINK" ]]; then
        if [[ -w "$(dirname "$SYMLINK")" ]]; then
            rm "$SYMLINK"
        else
            sudo rm "$SYMLINK"
        fi
        echo -e "  ${GREEN}✓${RESET} Symlink removed from $SYMLINK"
    else
        echo -e "  ${DIM}  No symlink found at $SYMLINK, skipping${RESET}"
    fi

    # Step 3: Optionally delete the repo
    echo ""
    echo -e "  ${YELLOW}?${RESET} Delete the agents-ui directory? (${DIM}${SCRIPT_DIR}${RESET})"
    read -rp "    [y/N] " DELETE_REPO
    DELETE_REPO_LOWER="$(echo "$DELETE_REPO" | tr '[:upper:]' '[:lower:]')"
    if [[ "$DELETE_REPO_LOWER" == "y" || "$DELETE_REPO_LOWER" == "yes" ]]; then
        rm -rf "$SCRIPT_DIR"
        echo -e "  ${GREEN}✓${RESET} Directory deleted"
    else
        echo -e "  ${DIM}  Keeping directory${RESET}"
    fi

    echo ""
    echo -e "  ${GREEN}${BOLD}agents-ui uninstalled.${RESET}"
    echo ""
}

cmd_health() {
    echo ""
    echo -e "${CYAN}${BOLD}agents-ui${RESET} health check ${DIM}(port ${PORT})${RESET}"
    echo ""

    PASS="${GREEN}✓${RESET}"
    WARN="${YELLOW}!${RESET}"
    FAIL="${RED}✗${RESET}"
    ERRORS=0

    # 1. Server
    if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
        echo -e "  ${PASS} Server              Running on port ${PORT}"
    else
        echo -e "  ${FAIL} Server              Not reachable on port ${PORT}"
        ERRORS=$((ERRORS + 1))
    fi

    # 2. WebSocket
    # Use Node.js to test WebSocket connectivity
    WS_RESULT=$(node -e "
        const ws = new WebSocket('ws://127.0.0.1:${PORT}/ws');
        const t = setTimeout(() => { console.log('fail'); process.exit(0); }, 3000);
        ws.onopen = () => { clearTimeout(t); ws.close(); console.log('ok'); process.exit(0); };
        ws.onerror = () => { clearTimeout(t); console.log('fail'); process.exit(0); };
    " 2>/dev/null || echo "fail")
    if [[ "$WS_RESULT" == "ok" ]]; then
        echo -e "  ${PASS} WebSocket           Connected to ws://127.0.0.1:${PORT}/ws"
    else
        echo -e "  ${FAIL} WebSocket           Connection failed"
        ERRORS=$((ERRORS + 1))
    fi

    # 3. Web Dashboard
    WEB_CONTENT_TYPE=$(curl -sf -o /dev/null -w '%{content_type}' "http://127.0.0.1:${PORT}/" 2>/dev/null || echo "")
    if [[ "$WEB_CONTENT_TYPE" == *"text/html"* ]]; then
        echo -e "  ${PASS} Web Dashboard       Serving at http://127.0.0.1:${PORT}"
    elif curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
        echo -e "  ${WARN} Web Dashboard       Server running but web assets not built"
        echo -e "                        ${DIM}Run: cd $SCRIPT_DIR && pnpm --filter @agents-ui/web run build${RESET}"
    else
        echo -e "  ${FAIL} Web Dashboard       Not reachable"
        ERRORS=$((ERRORS + 1))
    fi

    # 4. Hooks
    SETTINGS_FILE="$HOME/.claude/settings.json"
    HOOKS_BASE="http://localhost:${PORT}/api/hooks/"
    HOOK_EVENTS_LIST="SessionStart SessionEnd PreToolUse PostToolUse SubagentStart SubagentStop Stop PreCompact"
    TOTAL_HOOKS=8

    if [[ -f "$SETTINGS_FILE" ]]; then
        FOUND_HOOKS=$(python3 -c "
import json
with open('${SETTINGS_FILE}') as f:
    settings = json.load(f)
hooks = settings.get('hooks', {})
base = '${HOOKS_BASE}'
events = '${HOOK_EVENTS_LIST}'.split()
count = 0
for event in events:
    entries = hooks.get(event, [])
    for entry in entries:
        for h in entry.get('hooks', []):
            if h.get('type') == 'http' and isinstance(h.get('url', ''), str) and h['url'].startswith(base):
                count += 1
                break
print(count)
" 2>/dev/null || echo "0")

        if [[ "$FOUND_HOOKS" -eq "$TOTAL_HOOKS" ]]; then
            echo -e "  ${PASS} Hooks               All ${FOUND_HOOKS}/${TOTAL_HOOKS} hooks configured"
        elif [[ "$FOUND_HOOKS" -gt 0 ]]; then
            echo -e "  ${WARN} Hooks               ${FOUND_HOOKS}/${TOTAL_HOOKS} hooks configured"
            echo -e "                        ${DIM}Run: agents-ui setup${RESET}"
        else
            echo -e "  ${FAIL} Hooks               No hooks configured"
            echo -e "                        ${DIM}Run: agents-ui setup${RESET}"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo -e "  ${FAIL} Hooks               Settings file not found at ${SETTINGS_FILE}"
        ERRORS=$((ERRORS + 1))
    fi

    # 5. Background Service
    PLIST="$HOME/Library/LaunchAgents/com.agents-ui.server.plist"
    if [[ "$(uname)" == "Darwin" ]]; then
        if [[ -f "$PLIST" ]] && launchctl list 2>/dev/null | grep -q "com.agents-ui.server"; then
            echo -e "  ${PASS} Background Service  LaunchAgent loaded and running"
        elif [[ -f "$PLIST" ]]; then
            echo -e "  ${WARN} Background Service  LaunchAgent plist exists but not loaded"
        else
            echo -e "  ${WARN} Background Service  LaunchAgent not installed"
            echo -e "                        ${DIM}Run: agents-ui setup${RESET}"
        fi
    else
        if schtasks /query /tn "AgentsUI-Server" >/dev/null 2>&1; then
            echo -e "  ${PASS} Background Service  Windows Task Scheduler registered"
        else
            echo -e "  ${WARN} Background Service  Task not found"
            echo -e "                        ${DIM}Run: agents-ui setup${RESET}"
        fi
    fi

    echo ""
    if [[ "$ERRORS" -eq 0 ]]; then
        echo -e "  ${GREEN}${BOLD}All systems operational.${RESET}"
    else
        echo -e "  ${RED}${BOLD}${ERRORS} check(s) failed.${RESET}"
    fi
    echo ""
}

cmd_help() {
    echo ""
    echo -e "${CYAN}${BOLD}agents-ui${RESET} — Real-time Claude Code agent monitor"
    echo ""
    echo -e "  ${BOLD}Usage:${RESET}"
    echo ""
    echo -e "    ${CYAN}agents-ui${RESET}                  Start the TUI dashboard"
    echo -e "    ${CYAN}agents-ui web${RESET}              Start the web dashboard"
    echo -e "    ${CYAN}agents-ui health${RESET}           Check status of all components"
    echo -e "    ${CYAN}agents-ui start${RESET}            Same as agents-ui (default)"
    echo -e "    ${CYAN}agents-ui uninstall${RESET}        Remove agents-ui and hooks"
    echo -e "    ${CYAN}agents-ui help${RESET}             Show this help message"
    echo ""
    echo -e "  ${BOLD}Options:${RESET}"
    echo ""
    echo -e "    ${CYAN}-p, --port <port>${RESET}         Server port (default: 40110)"
    echo ""
    echo -e "  ${BOLD}Environment:${RESET}"
    echo ""
    echo -e "    ${CYAN}AGENTS_UI_PORT${RESET}             Override default port"
    echo ""
}

# ─── Route command ────────────────────────────────────────────────────────────
case "$COMMAND" in
    start)      cmd_start ;;
    web)        cmd_web ;;
    health)     cmd_health ;;
    uninstall)  cmd_uninstall ;;
    help|--help|-h)  cmd_help ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${RESET}"
        cmd_help
        exit 1
        ;;
esac
