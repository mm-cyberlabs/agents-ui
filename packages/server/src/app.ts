import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import fastifyCors from "@fastify/cors";
import { SessionStore } from "./state/session-store.js";
import { WsBroadcaster } from "./ws/ws-broadcaster.js";
import { registerHookRoutes } from "./hooks/hook-receiver.js";
import { registerSessionRoutes } from "./routes/sessions.js";

export interface AppOptions {
  port?: number;
  host?: string;
}

export async function createApp(options: AppOptions = {}) {
  const port = options.port ?? 7860;
  const host = options.host ?? "127.0.0.1";

  const app = Fastify({ logger: false });

  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyWebsocket);

  // Initialize session store
  const store = new SessionStore();
  const broadcaster = new WsBroadcaster(store);

  // WebSocket endpoint
  app.get("/ws", { websocket: true }, (socket) => {
    broadcaster.addClient(socket);
  });

  // Register routes
  registerHookRoutes(app, store);
  registerSessionRoutes(app, store);

  // Health check
  app.get("/api/health", async () => ({ status: "ok" }));

  // Initialize store (discover sessions, start tailing)
  await store.initialize();

  // Start listening
  await app.listen({ port, host });

  return { app, store, port, host };
}
