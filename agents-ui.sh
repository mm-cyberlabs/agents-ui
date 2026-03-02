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

PORT="${AGENTS_UI_PORT:-47860}"

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

# Also handle: agents-ui --port 9000 (before the command)
# Re-parse if first arg was a flag
if [[ "$COMMAND" == "-p" || "$COMMAND" == "--port" ]]; then
    PORT="${1:-$PORT}"
    COMMAND="${2:-start}"
fi

# ─── Commands ─────────────────────────────────────────────────────────────────

cmd_start() {
    echo -e "${CYAN}${BOLD}agents-ui${RESET} ${DIM}— starting on port ${PORT}${RESET}"
    cd "$SCRIPT_DIR"
    exec node packages/cli/dist/index.js start --port "$PORT"
}

cmd_web() {
    echo -e "${CYAN}${BOLD}agents-ui${RESET} ${DIM}— starting web UI on port ${PORT}${RESET}"
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
    if [[ "${DELETE_REPO,,}" == "y" || "${DELETE_REPO,,}" == "yes" ]]; then
        rm -rf "$SCRIPT_DIR"
        echo -e "  ${GREEN}✓${RESET} Directory deleted"
    else
        echo -e "  ${DIM}  Keeping directory${RESET}"
    fi

    echo ""
    echo -e "  ${GREEN}${BOLD}agents-ui uninstalled.${RESET}"
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
    echo -e "    ${CYAN}agents-ui start${RESET}            Same as agents-ui (default)"
    echo -e "    ${CYAN}agents-ui uninstall${RESET}        Remove agents-ui and hooks"
    echo -e "    ${CYAN}agents-ui help${RESET}             Show this help message"
    echo ""
    echo -e "  ${BOLD}Options:${RESET}"
    echo ""
    echo -e "    ${CYAN}-p, --port <port>${RESET}         Server port (default: 47860)"
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
    uninstall)  cmd_uninstall ;;
    help|--help|-h)  cmd_help ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${RESET}"
        cmd_help
        exit 1
        ;;
esac
