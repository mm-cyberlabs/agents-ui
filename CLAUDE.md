# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

agents-ui is a real-time monitoring dashboard for Claude Code CLI agents. It observes running sessions by tailing JSONL transcript files from `~/.claude/projects/` and optionally receiving HTTP hook events from Claude Code.

## Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm run build        # Build all packages (core → server/tui/web → cli)
pnpm run dev          # Start server + TUI in dev mode

# Per-package
pnpm --filter @agents-ui/core run build
pnpm --filter @agents-ui/server run build
pnpm --filter @agents-ui/tui run build
pnpm --filter @agents-ui/web run build     # Vite production build
pnpm --filter @agents-ui/web run dev       # Vite dev server with HMR
pnpm --filter @agents-ui/cli run dev       # Run CLI via tsx (no build needed)
```

## Architecture

pnpm monorepo with 5 packages under `packages/`:

- **core** — Shared TypeScript library (types, JSONL parser, file watchers, agent tree builder). Node.js-only exports at `@agents-ui/core`, browser-safe exports at `@agents-ui/core/browser`.
- **server** — Fastify HTTP/WebSocket server. Receives hook POSTs at `/api/hooks/:eventType`, tails JSONL files via core's `JsonlTail`, maintains in-memory `SessionStore`, broadcasts updates over WebSocket at `/ws`.
- **tui** — Ink (React for CLI) terminal dashboard. Connects to server via WebSocket.
- **web** — Vite + React + TypeScript + Tailwind web dashboard. Must import from `@agents-ui/core/browser` (not `@agents-ui/core`) to avoid Node.js module bundling errors.
- **cli** — Entry point. Manages the background server via macOS LaunchAgent. See CLI Commands below.

### CLI Commands

| Command | Description |
|---|---|
| `agents-ui setup` | Install: configures HTTP hooks + starts persistent background server (LaunchAgent) |
| `agents-ui teardown` | Uninstall: removes hooks + stops and removes background server |
| `agents-ui` | Opens TUI, connects to the running background server |
| `agents-ui web` | Opens web UI in browser |
| `agents-ui serve` | Runs server headlessly (used internally by LaunchAgent) |

### Background Server (macOS LaunchAgent)

The server runs as a persistent macOS LaunchAgent (`com.agents-ui.server`):
- Installed/started by `agents-ui setup`, removed by `agents-ui teardown`
- Plist at `~/Library/LaunchAgents/com.agents-ui.server.plist`
- `RunAtLoad: true` — starts on login; `KeepAlive: true` — restarts on crash
- Logs to `~/.claude/agents-ui-server.log`

### Session Discovery

`SessionWatcher` uses two mechanisms to find sessions:
1. **chokidar file watcher** — real-time fs events for new/changed JSONL files
2. **10-second polling interval** — periodic `discoverSessions()` re-scan as a fallback (chokidar can miss events on macOS)

### Data Flow

```
Claude Code sessions → JSONL files + HTTP hooks → server (SessionStore) → WebSocket → TUI/Web
```

### Key Types

- `JsonlLine` (core/types/jsonl.ts) — Union of UserMessage | AssistantMessage | SystemMessage | ProgressMessage | QueueOperation, matching real Claude Code JSONL format
- `Session` (core/types/session.ts) — Aggregated session state with agent tree, token usage, activity feed
- `AgentNode` (core/types/agent-tree.ts) — Tree structure: root agent + subagent children, built from Agent/Task tool_use blocks in JSONL
- `ServerMessage`/`ClientMessage` (core/types/ws-protocol.ts) — WebSocket protocol

### Important Patterns

- The `AgentTreeBuilder` (core/parsers/) detects subagent spawning by finding `tool_use` blocks with `name: "Agent"` or `name: "Task"`, and correlates completions via `toolUseResult.agentId` on user messages.
- `JsonlTail` tracks byte offset per file to avoid re-reading large files (sessions can be 100MB+).
- Session lifecycle: `active` → `idle` (60s no writes) → `completed` (5min or SessionEnd hook). Only active and idle sessions are shown in both TUI and web; completed sessions are filtered out.
- Waiting-for-input detection: `Session.waitingForInput` is set `true` when a `Stop` hook fires or an assistant message has `stop_reason === "end_turn"`. Cleared when `UserPromptSubmit` hook fires, a new user message arrives, or the session goes idle/completed.
- Server port defaults to 40110.

### TUI Features

- **Session list**: Shows active/idle sessions sorted by last activity, with selection cursor.
- **Agent tree**: Selectable agent list (up/down arrows) with a detail panel on the right showing status, model, tokens, context %, tools, prompt.
- **Activity feed**: Per-session activity events.
- **Token dashboard**: Token usage breakdown for selected session.
- **Waiting-for-input alert**: Blinking yellow banner at the top when any session is waiting for user input. Session list rows show `⚠ waiting` status.

### Web Dashboard Features

- **Multi-project grouping**: Sessions grouped by project with aggregate stats (tokens, agents, active count).
- **Agent map**: Interactive SVG tree with zoom/pan, status filter buttons (All/Running/Completed/Error), particle animations on running edges, and click-to-open detail modal.
- **Session detail**: Agent map + token chart + activity stream for a single session.
- **All Agents view** (`/agents`): Unified agent map showing all running agents across every active session in a single tree. Each session root is labeled with its project name.
- **Waiting-for-input popup**: Floating alert (top-right) for each session waiting for user input. Clickable to navigate to that session. Auto-dismisses when the user responds. Session cards and detail page also show a pulsing waiting badge.
