import { EventEmitter } from "eventemitter3";
import type {
  Session,
  ActivityEvent,
  AggregatedTokenUsage,
} from "@agents-ui/core";
import type { AgentNode } from "@agents-ui/core";
import {
  createEmptyTokenUsage,
  createRootAgent,
  AgentTreeBuilder,
  parseJsonlFile,
  discoverSessions,
  JsonlTail,
  SessionWatcher,
} from "@agents-ui/core";
import type { JsonlLine, AssistantMessage, UserMessage } from "@agents-ui/core";
import type { DiscoveredSession } from "@agents-ui/core";
import { randomUUID } from "node:crypto";

export interface SessionStoreEvents {
  "session:updated": (session: Session) => void;
  "session:removed": (sessionId: string) => void;
  activity: (event: ActivityEvent) => void;
  "agent:updated": (sessionId: string, agentTree: AgentNode) => void;
  "tokens:updated": (sessionId: string, usage: AggregatedTokenUsage) => void;
}

const IDLE_TIMEOUT_MS = 60_000; // 60s to idle
const COMPLETED_TIMEOUT_MS = 300_000; // 5min to completed
const MAX_RECENT_ACTIVITY = 200;

interface ManagedSession {
  session: Session;
  treeBuilder: AgentTreeBuilder;
  tail: JsonlTail;
  subagentTails: Map<string, JsonlTail>;
  idleTimer?: ReturnType<typeof setTimeout>;
  pendingToolTimer?: ReturnType<typeof setTimeout>;
}

export class SessionStore extends EventEmitter<SessionStoreEvents> {
  private sessions = new Map<string, ManagedSession>();
  private statusCheckInterval?: ReturnType<typeof setInterval>;
  private watcher?: SessionWatcher;

  getSessions(): Session[] {
    return Array.from(this.sessions.values()).map((m) => m.session);
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)?.session;
  }

  /**
   * Initialize the store: discover existing sessions and start tailing.
   * Only loads recent sessions (modified within the last 24 hours).
   */
  async initialize(): Promise<void> {
    const discovered = await discoverSessions();
    const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;

    for (const disc of discovered) {
      if (disc.lastModified.getTime() < recentCutoff) continue;
      await this.addSession(disc);
    }

    // Watch for new sessions (file watcher + 10s polling fallback)
    this.watcher = new SessionWatcher();
    this.watcher.on("session:discovered", (disc) => this.addSession(disc));
    this.watcher.on("session:updated", (disc) => {
      if (!this.sessions.has(disc.sessionId)) {
        this.addSession(disc);
      } else {
        // Check for new subagent files and start tailing them
        this.startNewSubagentTails(disc);
      }
    });
    await this.watcher.start();

    // Periodic status check
    this.statusCheckInterval = setInterval(() => this.checkSessionStatuses(), 10_000);
  }

  /**
   * Re-scan all sessions: discover new ones and re-evaluate status of existing ones.
   */
  async refresh(): Promise<void> {
    const discovered = await discoverSessions();
    const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;

    for (const disc of discovered) {
      if (disc.lastModified.getTime() < recentCutoff) continue;

      if (!this.sessions.has(disc.sessionId)) {
        await this.addSession(disc);
      } else {
        // Re-evaluate status of existing sessions based on fresh file mtime
        const managed = this.sessions.get(disc.sessionId)!;
        const ageMs = Date.now() - disc.lastModified.getTime();

        if (managed.session.waitingForInput) {
          managed.session.status = "active";
        } else if (ageMs <= IDLE_TIMEOUT_MS) {
          managed.session.status = "active";
        } else if (ageMs <= COMPLETED_TIMEOUT_MS) {
          managed.session.status = "idle";
        }

        // Check for new subagent files
        await this.startNewSubagentTails(disc);

        this.emit("session:updated", managed.session);
        this.emit("agent:updated", managed.session.id, managed.session.agentTree);
      }
    }
  }

  async shutdown(): Promise<void> {
    this.watcher?.stop();
    if (this.statusCheckInterval) clearInterval(this.statusCheckInterval);
    for (const [, managed] of this.sessions) {
      managed.tail.stop();
      for (const [, subTail] of managed.subagentTails) subTail.stop();
      if (managed.idleTimer) clearTimeout(managed.idleTimer);
      if (managed.pendingToolTimer) clearTimeout(managed.pendingToolTimer);
    }
    this.sessions.clear();
  }

  /**
   * Add and start tracking a discovered session.
   */
  async addSession(disc: DiscoveredSession): Promise<void> {
    if (this.sessions.has(disc.sessionId)) return;

    const now = new Date().toISOString();
    const treeBuilder = new AgentTreeBuilder(disc.sessionId, now);

    const session: Session = {
      id: disc.sessionId,
      projectPath: disc.projectDir,
      projectDir: disc.projectDir,
      cwd: "",
      gitBranch: "",
      version: "",
      status: "idle",
      waitingForInput: false,
      startedAt: now,
      lastActivityAt: disc.lastModified.toISOString(),
      messageCount: 0,
      tokenUsage: createEmptyTokenUsage(),
      agentTree: treeBuilder.getTree(),
      recentActivity: [],
    };

    const tail = new JsonlTail(disc.jsonlPath);
    const managed: ManagedSession = {
      session,
      treeBuilder,
      tail,
      subagentTails: new Map(),
    };

    this.sessions.set(disc.sessionId, managed);

    // Process lines from tail
    tail.on("line", (line) => this.processLine(disc.sessionId, line));

    // Start tailing (reads existing content, then watches)
    await tail.start();

    // Start subagent tails
    for (const subPath of disc.subagentPaths) {
      await this.startSubagentTail(disc.sessionId, subPath);
    }

    // Determine initial status based on file age, but respect waiting state.
    // If the session is waiting for user input, it's still alive — unless
    // the file hasn't been touched in over 2 hours (session is dead).
    const ageMs = Date.now() - disc.lastModified.getTime();
    const MAX_WAITING_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
    if (session.waitingForInput && ageMs > MAX_WAITING_AGE_MS) {
      // Too old — session is dead, not actually waiting
      session.waitingForInput = false;
      session.status = "completed";
    } else if (session.waitingForInput) {
      session.status = "active";
    } else if (ageMs > COMPLETED_TIMEOUT_MS) {
      session.status = "completed";
    } else if (ageMs > IDLE_TIMEOUT_MS) {
      session.status = "idle";
    } else {
      session.status = "active";
    }

    this.emit("session:updated", session);
  }

  /**
   * Process a hook event from Claude Code.
   */
  processHookEvent(sessionId: string, eventType: string, payload: Record<string, unknown>): void {
    const managed = this.sessions.get(sessionId);
    if (!managed) return;

    const { session } = managed;
    session.lastActivityAt = new Date().toISOString();
    this.resetIdleTimer(managed);

    if (session.status !== "active") {
      session.status = "active";
    }

    const activity = this.hookToActivity(sessionId, eventType, payload);
    if (activity) {
      this.addActivity(managed, activity);
    }

    // Detect waiting-for-input state.
    // Stop = Claude finished its turn, waiting for user.
    // Any other activity hook means Claude is working = not waiting.
    if (eventType === "Stop") {
      session.waitingForInput = true;
    }
    if (eventType === "UserPromptSubmit" || eventType === "SessionStart" || eventType === "SubagentStart") {
      session.waitingForInput = false;
    }

    // Track tool permission prompts: PreToolUse fires before user approval.
    // If PostToolUse doesn't follow within 3s, the tool is waiting for permission.
    if (eventType === "PreToolUse") {
      if (managed.pendingToolTimer) clearTimeout(managed.pendingToolTimer);
      managed.pendingToolTimer = setTimeout(() => {
        session.waitingForInput = true;
        this.emit("session:updated", session);
      }, 3000);
    }
    if (eventType === "PostToolUse" || eventType === "PostToolUseFailure") {
      if (managed.pendingToolTimer) {
        clearTimeout(managed.pendingToolTimer);
        managed.pendingToolTimer = undefined;
      }
      session.waitingForInput = false;
    }

    if (eventType === "SessionEnd") {
      session.status = "completed";
      session.waitingForInput = false;
    }

    if (eventType === "PreCompact") {
      session.tokenUsage.compactionCount++;
    }

    this.emit("session:updated", session);
  }

  private processLine(sessionId: string, line: JsonlLine): void {
    const managed = this.sessions.get(sessionId);
    if (!managed) return;

    const { session, treeBuilder } = managed;

    // Update session metadata from first real message
    if (line.type === "user" || line.type === "assistant") {
      if (!session.cwd && "cwd" in line) session.cwd = line.cwd;
      if (!session.gitBranch && "gitBranch" in line) session.gitBranch = line.gitBranch;
      if (!session.version && "version" in line) session.version = line.version;
      if ("slug" in line && line.slug) session.slug = line.slug;
      if ("timestamp" in line && line.timestamp) {
        if (!session.startedAt || line.timestamp < session.startedAt) {
          session.startedAt = line.timestamp;
        }
        session.lastActivityAt = line.timestamp;
      }
    }

    session.messageCount++;

    // Process through agent tree builder
    treeBuilder.processLine(line);
    session.agentTree = treeBuilder.getTree();
    session.tokenUsage = session.agentTree.tokenUsage;

    // Update model from assistant messages
    if (line.type === "assistant" && line.message.model) {
      session.model = line.message.model;
    }

    // Detect waiting-for-input from JSONL.
    // Assistant message: waiting only if stop_reason is end_turn.
    // User message (real input, not tool results): clears waiting.
    // Other line types (system, progress): don't change waiting state.
    if (line.type === "assistant") {
      session.waitingForInput = line.message.stop_reason === "end_turn";
    } else if (line.type === "user" && !line.isMeta && !line.toolUseResult) {
      const content = line.message.content;
      const isToolResult =
        Array.isArray(content) && content.some((b) => (b as { type: string }).type === "tool_result");
      if (!isToolResult) {
        session.waitingForInput = false;
      }
    }

    // Generate activity events
    const activities = this.lineToActivities(sessionId, line);
    for (const activity of activities) {
      this.addActivity(managed, activity);
    }

    // Mark active
    if (session.status !== "active") {
      session.status = "active";
    }
    this.resetIdleTimer(managed);

    this.emit("session:updated", session);
    this.emit("tokens:updated", sessionId, session.tokenUsage);
    this.emit("agent:updated", sessionId, session.agentTree);
  }

  /**
   * Check for new subagent JSONL files and start tailing them.
   */
  private async startNewSubagentTails(disc: DiscoveredSession): Promise<void> {
    const managed = this.sessions.get(disc.sessionId);
    if (!managed) return;

    for (const subPath of disc.subagentPaths) {
      const match = subPath.match(/agent-([a-f0-9]+)\.jsonl$/);
      if (!match) continue;
      const agentId = match[1];
      if (!managed.subagentTails.has(agentId)) {
        await this.startSubagentTail(disc.sessionId, subPath);
      }
    }
  }

  private async startSubagentTail(sessionId: string, subPath: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (!managed) return;

    // Extract agentId from filename: agent-<id>.jsonl
    const match = subPath.match(/agent-([a-f0-9]+)\.jsonl$/);
    if (!match) return;
    const agentId = match[1];

    const tail = new JsonlTail(subPath);
    managed.subagentTails.set(agentId, tail);

    tail.on("line", (line) => {
      managed.treeBuilder.processSubagentLine(agentId, line);
      managed.session.agentTree = managed.treeBuilder.getTree();
      this.emit("agent:updated", sessionId, managed.session.agentTree);
    });

    await tail.start();
  }

  private lineToActivities(sessionId: string, line: JsonlLine): ActivityEvent[] {
    const events: ActivityEvent[] = [];

    if (line.type === "user" && !line.toolUseResult && !line.isMeta) {
      const msg = line as UserMessage;
      let text = "";
      if (typeof msg.message.content === "string") {
        text = msg.message.content;
      } else if (Array.isArray(msg.message.content)) {
        text = msg.message.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join(" ");
      }
      if (text.trim()) {
        events.push({
          id: randomUUID(),
          type: "user_input",
          timestamp: msg.timestamp,
          sessionId,
          data: { text: text.slice(0, 500) },
        });
      }
    }

    if (line.type === "assistant") {
      const msg = line as AssistantMessage;
      for (const block of msg.message.content) {
        if (block.type === "text" && block.text.trim()) {
          events.push({
            id: randomUUID(),
            type: "text",
            timestamp: msg.timestamp,
            sessionId,
            data: { text: block.text.slice(0, 500) },
          });
        }
        if (block.type === "tool_use") {
          if (block.name === "Agent" || block.name === "Task") {
            const input = block.input as Record<string, unknown>;
            events.push({
              id: randomUUID(),
              type: "subagent_start",
              timestamp: msg.timestamp,
              sessionId,
              data: {
                agentType: (input.subagent_type as string) ?? (input.description as string),
                prompt: (input.prompt as string)?.slice(0, 200),
                model: input.model as string | undefined,
              },
            });
          } else {
            events.push({
              id: randomUUID(),
              type: "tool_start",
              timestamp: msg.timestamp,
              sessionId,
              data: {
                toolName: block.name,
                toolInput: block.input,
              },
            });
          }
        }
      }
    }

    if (line.type === "user" && line.toolUseResult) {
      events.push({
        id: randomUUID(),
        type: "subagent_end",
        timestamp: line.timestamp,
        sessionId,
        agentId: line.toolUseResult.agentId,
        data: {
          durationMs: parseInt(line.toolUseResult.totalDurationMs, 10) || undefined,
        },
      });
    }

    if (line.type === "system" && (line.subtype === "compact_boundary" || line.compactMetadata)) {
      events.push({
        id: randomUUID(),
        type: "compaction",
        timestamp: line.timestamp,
        sessionId,
        data: {},
      });
    }

    return events;
  }

  private hookToActivity(
    sessionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): ActivityEvent | null {
    const timestamp = new Date().toISOString();

    switch (eventType) {
      case "PreToolUse":
        return {
          id: randomUUID(),
          type: "tool_start",
          timestamp,
          sessionId,
          data: {
            toolName: payload.tool_name as string,
            toolInput: payload.tool_input as Record<string, unknown>,
          },
        };
      case "PostToolUse":
        return {
          id: randomUUID(),
          type: "tool_end",
          timestamp,
          sessionId,
          data: {
            toolName: payload.tool_name as string,
            durationMs: payload.duration_ms as number,
          },
        };
      case "SubagentStart":
        return {
          id: randomUUID(),
          type: "subagent_start",
          timestamp,
          sessionId,
          data: {
            agentType: payload.agent_type as string,
            prompt: payload.prompt as string,
            model: payload.model as string,
          },
        };
      case "SubagentStop":
        return {
          id: randomUUID(),
          type: "subagent_end",
          timestamp,
          sessionId,
          agentId: payload.agent_id as string,
          data: {
            durationMs: payload.duration_ms as number,
          },
        };
      case "PreCompact":
        return {
          id: randomUUID(),
          type: "compaction",
          timestamp,
          sessionId,
          data: {},
        };
      default:
        return null;
    }
  }

  private addActivity(managed: ManagedSession, event: ActivityEvent): void {
    managed.session.recentActivity.push(event);
    if (managed.session.recentActivity.length > MAX_RECENT_ACTIVITY) {
      managed.session.recentActivity = managed.session.recentActivity.slice(-MAX_RECENT_ACTIVITY);
    }
    this.emit("activity", event);
  }

  private resetIdleTimer(managed: ManagedSession): void {
    if (managed.idleTimer) clearTimeout(managed.idleTimer);

    managed.idleTimer = setTimeout(() => {
      // Don't downgrade sessions that are waiting for user input —
      // they're still alive, just waiting.
      if (managed.session.waitingForInput) return;

      if (managed.session.status === "active") {
        managed.session.status = "idle";
        this.markRunningAgentsCompleted(managed.session.agentTree, managed.session.lastActivityAt);
        this.emit("session:updated", managed.session);
        this.emit("agent:updated", managed.session.id, managed.session.agentTree);
      }

      // Set completed timer
      managed.idleTimer = setTimeout(() => {
        if (managed.session.waitingForInput) return;
        if (managed.session.status === "idle") {
          managed.session.status = "completed";
          this.emit("session:updated", managed.session);
        }
      }, COMPLETED_TIMEOUT_MS - IDLE_TIMEOUT_MS);
    }, IDLE_TIMEOUT_MS);
  }

  private checkSessionStatuses(): void {
    const now = Date.now();
    const MAX_WAITING_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
    for (const [sessionId, managed] of this.sessions) {
      const age = now - new Date(managed.session.lastActivityAt).getTime();
      let changed = false;

      // Expire stale waiting sessions (no activity for 2+ hours)
      if (managed.session.waitingForInput && age > MAX_WAITING_AGE_MS) {
        managed.session.waitingForInput = false;
        managed.session.status = "completed";
        changed = true;
      }

      // Don't downgrade sessions waiting for user input
      if (managed.session.waitingForInput) {
        if (changed) {
          this.emit("session:updated", managed.session);
          this.emit("agent:updated", sessionId, managed.session.agentTree);
        }
        continue;
      }

      if (managed.session.status === "active" && age > IDLE_TIMEOUT_MS) {
        managed.session.status = "idle";
        this.markRunningAgentsCompleted(managed.session.agentTree, managed.session.lastActivityAt);
        changed = true;
      }
      if (managed.session.status === "idle" && age > COMPLETED_TIMEOUT_MS) {
        managed.session.status = "completed";
        changed = true;
      }

      if (changed) {
        this.emit("session:updated", managed.session);
        this.emit("agent:updated", sessionId, managed.session.agentTree);
      }
    }
  }

  /**
   * When a session goes idle, mark any agents still showing "running" as completed.
   */
  private markRunningAgentsCompleted(node: AgentNode, completedAt: string): void {
    if (node.status === "running") {
      node.status = "completed";
      node.completedAt = completedAt;
      node.currentTool = undefined;
    }
    for (const child of node.children) {
      this.markRunningAgentsCompleted(child, completedAt);
    }
  }
}
