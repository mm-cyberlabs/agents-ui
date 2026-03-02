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

# ─── Helpers ──────────────────────────────────────────────────────────────────
info()    { echo -e "  ${CYAN}→${RESET} $1"; }
success() { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()    { echo -e "  ${YELLOW}!${RESET} $1"; }
fail()    { echo -e "  ${RED}✗${RESET} $1"; exit 1; }
step()    { echo -e "\n${BOLD}[$1/$TOTAL_STEPS] $2${RESET}"; }

TOTAL_STEPS=5
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${AGENTS_UI_PORT:-47860}"
INSTALL_DIR="/usr/local/bin"

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}"
echo "   ╔═══════════════════════════════════════╗"
echo "   ║         agents-ui  installer          ║"
echo "   ║   Real-time Claude Code agent monitor ║"
echo "   ╚═══════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  ${DIM}This will install agents-ui and configure${RESET}"
echo -e "  ${DIM}Claude Code hooks for real-time monitoring.${RESET}"
echo ""

# ─── Step 1: Check prerequisites ─────────────────────────────────────────────
step 1 "Checking prerequisites"

# macOS check
if [[ "$(uname -s)" == "Darwin" ]]; then
    success "macOS detected"
else
    warn "Non-macOS system detected ($(uname -s)). This installer is optimized for macOS but should still work."
fi

# Node.js check
if ! command -v node &>/dev/null; then
    fail "Node.js is not installed. Install it from https://nodejs.org (v20+) or via Homebrew: brew install node"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 20 ]]; then
    fail "Node.js v20+ is required (found v$(node -v | sed 's/v//')). Update via: brew upgrade node"
fi
success "Node.js v$(node -v | sed 's/v//') found"

# pnpm check
if ! command -v pnpm &>/dev/null; then
    warn "pnpm not found. Installing via corepack..."
    if command -v corepack &>/dev/null; then
        corepack enable
        corepack prepare pnpm@latest --activate
        success "pnpm installed via corepack"
    else
        fail "pnpm is not installed and corepack is unavailable. Install pnpm: npm install -g pnpm"
    fi
else
    success "pnpm $(pnpm -v) found"
fi

# Claude Code check
if [[ -d "$HOME/.claude" ]]; then
    success "Claude Code directory found (~/.claude)"
else
    warn "~/.claude directory not found. Claude Code may not be installed."
    warn "agents-ui will still install, but won't find any sessions until Claude Code runs."
fi

# ─── Step 2: Install dependencies ────────────────────────────────────────────
step 2 "Installing dependencies"

cd "$SCRIPT_DIR"
info "Running pnpm install..."
pnpm install --reporter=default 2>&1 | tail -5
success "Dependencies installed"

# ─── Step 3: Build all packages ──────────────────────────────────────────────
step 3 "Building packages"

info "Building core → server, tui, web → cli..."
pnpm run build 2>&1 | grep -E "(Done|built in)" || true
success "All packages built"

# ─── Step 4: Configure Claude Code hooks ─────────────────────────────────────
step 4 "Configuring Claude Code hooks"

SETTINGS_FILE="$HOME/.claude/settings.json"
HOOKS_BASE_URL="http://localhost:${PORT}"

# Ensure ~/.claude directory exists
mkdir -p "$HOME/.claude"

# Hook events to register
HOOK_EVENTS=("SessionStart" "SessionEnd" "PreToolUse" "PostToolUse" "SubagentStart" "SubagentStop" "Stop" "PreCompact")

# Build hook URL from event name (PascalCase → kebab-case)
to_kebab() {
    python3 -c "
import re, sys
s = sys.argv[1]
print(re.sub(r'(?<!^)(?=[A-Z])', '-', s).lower())
" "$1"
}

# Read existing settings or create empty object
if [[ -f "$SETTINGS_FILE" ]]; then
    SETTINGS=$(cat "$SETTINGS_FILE")
    # Validate JSON
    if ! echo "$SETTINGS" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
        warn "Existing settings.json is invalid JSON. Backing up and creating new one."
        cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak.$(date +%s)"
        SETTINGS='{}'
    fi
else
    SETTINGS='{}'
fi

# Use python3 (ships with macOS) to safely merge hooks into settings.json
SETTINGS=$(echo "$SETTINGS" | python3 -c "
import sys, json

settings = json.load(sys.stdin)
hooks = settings.get('hooks', {})
base_url = '${HOOKS_BASE_URL}'
events = '${HOOK_EVENTS[*]}'.split()

for event in events:
    # Convert PascalCase to kebab-case
    slug = ''
    for i, ch in enumerate(event):
        if ch.isupper() and i > 0:
            slug += '-'
        slug += ch.lower()

    url = f'{base_url}/api/hooks/{slug}'
    existing = hooks.get(event, [])

    # Check if already configured
    already = any(
        isinstance(entry, dict)
        and isinstance(entry.get('hooks'), list)
        and any(h.get('type') == 'http' and h.get('url') == url for h in entry['hooks'])
        for entry in existing
    )

    if not already:
        existing.append({'hooks': [{'type': 'http', 'url': url, 'timeout': 5}]})
        hooks[event] = existing

settings['hooks'] = hooks
print(json.dumps(settings, indent=2))
")

echo "$SETTINGS" > "$SETTINGS_FILE"

for event in "${HOOK_EVENTS[@]}"; do
    slug=$(to_kebab "$event")
    success "${event} → ${HOOKS_BASE_URL}/api/hooks/${slug}"
done

success "Hooks configured in ~/.claude/settings.json"

# ─── Step 5: Create launcher symlink ─────────────────────────────────────────
step 5 "Creating agents-ui command"

LAUNCHER="$SCRIPT_DIR/agents-ui.sh"
chmod +x "$LAUNCHER"

# Determine install location
if [[ -w "$INSTALL_DIR" ]]; then
    ln -sf "$LAUNCHER" "$INSTALL_DIR/agents-ui"
    success "Symlinked to $INSTALL_DIR/agents-ui"
else
    info "Need permission to create symlink in $INSTALL_DIR"
    sudo ln -sf "$LAUNCHER" "$INSTALL_DIR/agents-ui"
    success "Symlinked to $INSTALL_DIR/agents-ui (with sudo)"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}   ╔═══════════════════════════════════════╗"
echo "   ║       Installation complete!          ║"
echo -e "   ╚═══════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Usage:${RESET}"
echo ""
echo -e "    ${CYAN}agents-ui${RESET}            Start the TUI dashboard"
echo -e "    ${CYAN}agents-ui web${RESET}        Start the web dashboard"
echo -e "    ${CYAN}agents-ui --port 9000${RESET} Use a custom port"
echo -e "    ${CYAN}agents-ui uninstall${RESET}  Remove agents-ui completely"
echo ""
echo -e "  ${DIM}Open a Claude Code session in another terminal and${RESET}"
echo -e "  ${DIM}watch your agents appear in real-time.${RESET}"
echo ""
