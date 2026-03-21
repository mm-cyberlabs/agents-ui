import type { FastifyInstance } from "fastify";
import type { SessionStore } from "../state/session-store.js";

/**
 * Register hook receiver routes.
 * Claude Code POSTs to /api/hooks/:eventType with JSON payloads.
 */
/** Convert kebab-case URL slug back to PascalCase event type */
function kebabToPascal(slug: string): string {
  return slug.replace(/(^|-)([a-z])/g, (_, _dash, c) => c.toUpperCase());
}

export function registerHookRoutes(app: FastifyInstance, store: SessionStore): void {
  app.post<{
    Params: { eventType: string };
    Body: Record<string, unknown>;
  }>("/api/hooks/:eventType", async (request, reply) => {
    const eventType = kebabToPascal(request.params.eventType);
    const payload = request.body ?? {};

    // Extract session_id from the payload
    const sessionId =
      (payload.session_id as string) ??
      (payload.sessionId as string);

    if (!sessionId) {
      return reply.status(400).send({ error: "Missing session_id" });
    }

    store.processHookEvent(sessionId, eventType, payload);

    return reply.status(200).send({ ok: true });
  });
}
