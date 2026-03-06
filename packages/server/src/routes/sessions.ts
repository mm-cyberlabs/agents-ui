import type { FastifyInstance } from "fastify";
import { discoverInstalledConfig } from "@agents-ui/core";
import type { SessionStore } from "../state/session-store.js";

export function registerSessionRoutes(app: FastifyInstance, store: SessionStore): void {
  app.get("/api/config", async () => {
    return discoverInstalledConfig();
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
