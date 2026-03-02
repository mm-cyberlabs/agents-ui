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
- **cli** — Entry point. `agents-ui` starts server + TUI, `agents-ui web` opens browser, `agents-ui setup` configures HTTP hooks in `~/.claude/settings.json`.

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
- Session lifecycle: `active` → `idle` (60s no writes) → `completed` (5min or SessionEnd hook).
- Server port defaults to 47860.
