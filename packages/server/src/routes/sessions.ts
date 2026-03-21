import { execSync } from "node:child_process";
import type { FastifyInstance } from "fastify";
import { discoverInstalledConfig } from "@agents-ui/core";
import type { SessionStore } from "../state/session-store.js";

// Version check cache
let versionCache: { currentCommit: string; latestCommit: string | null; updateAvailable: boolean } | null = null;
let versionCacheTime = 0;
const VERSION_CACHE_TTL = 60 * 1000; // 1 minute

// Resolve current git commit at startup
function getCurrentCommit(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return "unknown";
  }
}

const CURRENT_COMMIT = getCurrentCommit();

export function registerSessionRoutes(app: FastifyInstance, store: SessionStore): void {
  app.get("/api/config", async () => {
    return discoverInstalledConfig();
  });

  // Version check endpoint — compares local git commit to latest on GitHub main
  app.get("/api/version", async () => {
    const now = Date.now();
    if (versionCache && now - versionCacheTime < VERSION_CACHE_TTL) {
      return versionCache;
    }

    let latestCommit: string | null = null;
    try {
      const res = await fetch("https://api.github.com/repos/mm-cyberlabs/agents-ui/commits/main", {
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json() as { sha: string };
        latestCommit = data.sha;
      }
    } catch {
      // GitHub unavailable
    }

    versionCache = {
      currentCommit: CURRENT_COMMIT,
      latestCommit,
      updateAvailable: latestCommit !== null && CURRENT_COMMIT !== "unknown" && latestCommit !== CURRENT_COMMIT,
    };
    versionCacheTime = now;
    return versionCache;
  });

  app.post("/api/refresh", async () => {
    await store.refresh();
    return { status: "ok", sessions: store.getSessions().length };
  });

  app.get("/api/sessions", async () => {
    return store.getSessions();
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    const session = store.getSession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return session;
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id/agents", async (request, reply) => {
    const session = store.getSession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return session.agentTree;
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id/tokens", async (request, reply) => {
    const session = store.getSession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return session.tokenUsage;
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id/activity", async (request, reply) => {
    const session = store.getSession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return session.recentActivity;
  });
}
