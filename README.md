# agents-ui

Real-time monitoring dashboard for Claude Code CLI agents. See what every agent and subagent is doing, track token usage, context window health, and inter-agent communication — all running locally on your machine.

![TUI + Web](https://img.shields.io/badge/interfaces-TUI%20%2B%20Web-cyan)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Node.js >=20](https://img.shields.io/badge/Node.js-%3E%3D20-green)

## What It Does

When you run Claude Code in your terminal, agents-ui observes the session in real-time by tailing the JSONL transcript files that Claude Code writes to `~/.claude/projects/`. It builds a live view of:

- **Active sessions** across all your projects
- **Agent trees** — which subagents (Explore, Plan, custom agents) were spawned, what they're working on, and their status
- **Activity feed** — every tool call (Read, Edit, Bash, etc.) as it happens
- **Token usage** — input/output/cache breakdown, per-model stats
- **Context window health** — how full the context is, when compaction events occur
- **Waiting-for-input alerts** — get notified when Claude is waiting for your input (blinking TUI banner, web popup)

Two interfaces are available: a **terminal UI** (Ink/React) and a **web dashboard** (React + Tailwind).

## Architecture

```
┌──────────────────────────────────────┐
│     Claude Code CLI Sessions         │
│   (running in your terminals)        │
└────────┬─────────────┬───────────────┘
         │             │
    JSONL writes    HTTP Hook POSTs
    to ~/.claude/   (optional, lower
    projects/       latency)
         │             │
         ▼             ▼
┌──────────────────────────────────────────────────┐
│               @agents-ui/server                  │
│                                                  │
│  ┌─────────────┐       ┌─────────────────┐       │
│  │ JSONL Tailer │       │ Hook Receiver   │       │
│  │ (chokidar +  │       │ POST /api/hooks │       │
│  │  byte-offset │       └────────┬────────┘       │
│  │  tracking)   │                │                │
│  └──────┬───────┘                │                │
│         │                        │                │
│         ▼                        ▼                │
│  ┌──────────────────────────────────────┐         │
│  │           Session Store              │         │
│  │   In-memory Map<sessionId, Session>  │         │
│  │                                      │         │
│  │  • Agent tree builder (detects       │         │
│  │    Agent/Task tool_use → subagents)  │         │
│  │  • Token aggregation                 │         │
│  │  • Session lifecycle management      │         │
│  │    (active → idle → completed)       │         │
│  └──────────────┬───────────────────────┘         │
│                 │                                 │
│        ┌────────┴──────────┐                      │
│        ▼                   ▼                      │
│  ┌──────────┐    ┌───────────────┐                │
│  │ REST API │    │  WebSocket    │                │
│  │ /api/*   │    │  Server /ws   │                │
│  └──────────┘    └───────┬───────┘                │
│                          │                        │
└──────────────────────────┼────────────────────────┘
                           │
               ┌───────────┴────────────┐
               ▼                        ▼
      ┌──────────────┐        ┌──────────────┐
      │   TUI (Ink)  │        │  Web (React) │
      │  Terminal UI  │        │  Browser UI  │
      └──────────────┘        └──────────────┘
```

### Monorepo Packages

| Package | Name | Description |
|---------|------|-------------|
| `packages/core` | `@agents-ui/core` | Shared types, JSONL parser, file watchers, agent tree builder |
| `packages/server` | `@agents-ui/server` | Fastify HTTP + WebSocket server, session store, hook receiver |
| `packages/tui` | `@agents-ui/tui` | Ink (React for terminal) dashboard with 4 tabbed views |
| `packages/web` | `@agents-ui/web` | Vite + React + Tailwind web dashboard |
| `packages/cli` | `@agents-ui/cli` | CLI entry point — starts server, TUI, or web UI |

### Data Sources

**JSONL File Tailing (primary, always active)**

Claude Code writes full conversation transcripts as JSONL files to `~/.claude/projects/<encoded-project-path>/<session-id>.jsonl`. Subagent transcripts go to `<session-id>/subagents/agent-<agentId>.jsonl`. The `JsonlTail` watcher tracks byte offsets per file to efficiently tail even 100MB+ session files without re-reading.

**HTTP Hooks (configured automatically by the installer)**

Claude Code supports HTTP hooks that POST JSON to a URL on lifecycle events. The installer configures these hooks in `~/.claude/settings.json` to POST to the agents-ui server. This gives near-instant event notifications (tool starts, subagent spawns, session events) while JSONL tailing fills in the complete content.

Both data sources work together: hooks provide low-latency signals, JSONL provides full conversation context.

### Session Lifecycle

Sessions transition through three states based on JSONL file activity:

- **Active** — receiving new data
- **Idle** — no new data for 60 seconds
- **Completed** — idle for 5 minutes, or a `SessionEnd` hook event is received

Sessions also track a `waitingForInput` flag, set when Claude stops with `end_turn` or a `Stop` hook fires. This is cleared when the user provides input (`UserPromptSubmit` hook or a new user message in JSONL). Both the TUI and web dashboard surface this as prominent alerts.

On startup, the server discovers all sessions modified within the last 24 hours and begins tailing their JSONL files.

### Agent Tree Construction

The `AgentTreeBuilder` processes JSONL lines to build a hierarchical tree of agents:

1. **Root agent** — the main Claude Code session
2. **Subagent detection** — when an assistant message contains a `tool_use` block with `name: "Agent"` or `name: "Task"`, a child node is created
3. **Subagent tracking** — separate JSONL files in the `subagents/` directory are tailed to update each child's token usage and tool counts
4. **Completion correlation** — when a user message arrives with a `toolUseResult`, it's matched to the pending subagent to record status, duration, and final metrics

### WebSocket Protocol

Clients connect to `/ws` and receive real-time updates:

| Server → Client | Description |
|-----------------|-------------|
| `sessions:snapshot` | Full session list (sent on connect) |
| `session:updated` | Single session changed |
| `session:removed` | Session deleted |
| `activity` | Real-time activity event (tool call, text, subagent spawn, etc.) |
| `agent:updated` | Agent tree changed for a session |
| `tokens:updated` | Token usage changed for a session |

| Client → Server | Description |
|-----------------|-------------|
| `subscribe` | Subscribe to specific sessions or `"all"` |
| `unsubscribe` | Remove subscriptions |
| `get:sessions` | Request fresh snapshot |
| `get:session` | Request single session update |

### REST API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/sessions` | List all sessions |
| `GET /api/sessions/:id` | Get single session |
| `GET /api/sessions/:id/agents` | Get agent tree |
| `GET /api/sessions/:id/tokens` | Get token usage |
| `GET /api/sessions/:id/activity` | Get recent activity events |
| `POST /api/hooks/:eventType` | Receive Claude Code hook events |

## Install

**Prerequisites:** macOS, Node.js >= 20, Claude Code CLI

```bash
git clone https://github.com/mm-cyberlabs/agents-ui.git
cd agents-ui
./install.sh
```

The installer wizard will:

1. Check prerequisites (Node.js, pnpm — installs pnpm via corepack if missing)
2. Install dependencies and build all packages
3. Configure Claude Code HTTP hooks in `~/.claude/settings.json` for low-latency monitoring
4. Create the `agents-ui` command in your PATH

That's it. No manual steps.

## Usage

```bash
agents-ui              # Start the TUI dashboard
agents-ui web          # Start the web dashboard (opens browser)
agents-ui --port 40110  # Use a custom port
```

Open a Claude Code session in another terminal and watch your agents appear in real-time.

**TUI keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `1` – `4` | Jump to tab (Sessions, Agents, Activity, Tokens) |
| `←` `→` | Switch between tabs |
| `↑` `↓` | Select session in the list |
| `q` / `Ctrl+C` | Quit |

## Uninstall

```bash
agents-ui uninstall
```

This will:
1. Remove Claude Code hooks from `~/.claude/settings.json`
2. Remove the `agents-ui` command from your PATH
3. Optionally delete the repo directory

## Development

### Build

```bash
# Build all packages
pnpm run build

# Build individual packages
pnpm --filter @agents-ui/core run build
pnpm --filter @agents-ui/server run build
pnpm --filter @agents-ui/tui run build
pnpm --filter @agents-ui/web run build
pnpm --filter @agents-ui/cli run build
```

Build order: `core` → `server`, `tui`, `web` (parallel) → `cli`

### Dev mode

```bash
# Run CLI directly via tsx (no build needed)
pnpm --filter @agents-ui/cli run dev

# Vite dev server for web with HMR
pnpm --filter @agents-ui/web run dev

# Watch mode for core types
pnpm --filter @agents-ui/core run dev
```

### Project structure

```
packages/
├── core/src/
│   ├── types/           # JsonlLine, Session, AgentNode, HookEvent, WS protocol
│   ├── parsers/         # JSONL parser, session discovery, agent tree builder, token aggregator
│   ├── watchers/        # JsonlTail (byte-offset file tailing), SessionWatcher
│   ├── ws-client.ts     # Framework-agnostic WebSocket client
│   ├── index.ts         # Node.js exports (server, TUI)
│   └── browser.ts       # Browser-safe exports (web) — types + pure functions only
├── server/src/
│   ├── app.ts           # Fastify app factory
│   ├── state/           # SessionStore (in-memory state manager)
│   ├── hooks/           # HTTP hook receiver routes
│   ├── ws/              # WebSocket server + broadcaster
│   └── routes/          # REST API routes
├── tui/src/
│   ├── app.tsx          # Root Ink app with tabbed navigation
│   ├── views/           # SessionList, AgentTreeView, ActivityFeed, TokenDashboard
│   ├── components/      # StatusBadge, TreeNode, ProgressBar, TabBar
│   └── hooks/           # useWs (WebSocket connection)
├── web/src/
│   ├── App.tsx          # React Router setup
│   ├── pages/           # Dashboard, SessionDetail
│   ├── components/      # SessionCard, AgentTree, ActivityStream, TokenChart, ContextHealth, WaitingAlert
│   ├── hooks/           # useWs (WebSocket connection)
│   └── styles/          # Tailwind globals
└── cli/src/
    ├── index.ts         # Commander CLI (start, web, setup, teardown commands)
    └── setup/           # Hook configuration for ~/.claude/settings.json
```

### Web imports

The web package must import from `@agents-ui/core/browser` instead of `@agents-ui/core`. The browser entry point only exports types and pure functions — no Node.js APIs (`fs`, `path`, `chokidar`, etc.) that would fail in the browser bundle.

## License

See [LICENSE](./LICENSE).
