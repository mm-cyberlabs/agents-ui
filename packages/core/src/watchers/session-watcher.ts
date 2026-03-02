import { watch, type FSWatcher } from "chokidar";
import { EventEmitter } from "eventemitter3";
import { getProjectsDir } from "../utils/paths.js";
import { discoverSessions, type DiscoveredSession } from "../parsers/session-discovery.js";

export interface SessionWatcherEvents {
  "session:discovered": (session: DiscoveredSession) => void;
  "session:updated": (session: DiscoveredSession) => void;
  "session:removed": (sessionId: string) => void;
  error: (error: Error) => void;
}

/**
 * Watches ~/.claude/projects/ for new, updated, and removed session JSONL files.
 * Emits events that the server can use to manage the session store.
 */
export class SessionWatcher extends EventEmitter<SessionWatcherEvents> {
  private watcher: FSWatcher | null = null;
  private knownSessions = new Map<string, DiscoveredSession>();

  /**
   * Start watching. Performs initial discovery, then watches for changes.
   */
  async start(): Promise<DiscoveredSession[]> {
    // Initial discovery
    const sessions = await discoverSessions();
    for (const session of sessions) {
      this.knownSessions.set(session.sessionId, session);
    }

    // Watch projects directory for new JSONL files
    const projectsDir = getProjectsDir();
    this.watcher = watch(projectsDir, {
      persistent: false,
      depth: 3, // project_dir / session_id / subagents / agent.jsonl
      ignoreInitial: true,
      ignored: (path) => {
        // Only watch .jsonl files and directories
        return !path.endsWith(".jsonl") && !path.includes(".");
      },
    });

    this.watcher.on("add", (filePath) => this.handleFileAdd(filePath));
    this.watcher.on("change", (filePath) => this.handleFileChange(filePath));
    this.watcher.on("unlink", (filePath) => this.handleFileRemove(filePath));
    this.watcher.on("error", (err) => this.emit("error", err instanceof Error ? err : new Error(String(err))));

    return sessions;
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  private async handleFileAdd(filePath: string): Promise<void> {
    if (!filePath.endsWith(".jsonl")) return;

    // Re-discover to get full metadata
    try {
      const sessions = await discoverSessions();
      for (const session of sessions) {
        if (!this.knownSessions.has(session.sessionId)) {
          this.knownSessions.set(session.sessionId, session);
          this.emit("session:discovered", session);
        }
      }
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  private handleFileChange(filePath: string): void {
    if (!filePath.endsWith(".jsonl")) return;

    // Find the session this file belongs to
    for (const [, session] of this.knownSessions) {
      if (session.jsonlPath === filePath) {
        session.lastModified = new Date();
        this.emit("session:updated", session);
        return;
      }
      // Check subagent paths
      if (session.subagentPaths.includes(filePath)) {
        session.lastModified = new Date();
        this.emit("session:updated", session);
        return;
      }
    }
  }

  private handleFileRemove(filePath: string): void {
    if (!filePath.endsWith(".jsonl")) return;

    for (const [sessionId, session] of this.knownSessions) {
      if (session.jsonlPath === filePath) {
        this.knownSessions.delete(sessionId);
        this.emit("session:removed", sessionId);
        return;
      }
    }
  }
}
