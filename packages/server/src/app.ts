import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { SessionStore } from "./state/session-store.js";
import { WsBroadcaster } from "./ws/ws-broadcaster.js";
import { registerHookRoutes } from "./hooks/hook-receiver.js";
import { registerSessionRoutes } from "./routes/sessions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  port?: number;
  host?: string;
}

export async function createApp(options: AppOptions = {}) {
  const port = options.port ?? 40110;
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

  // Serve web dashboard static files (built Vite output from @agents-ui/web)
  const webDistDir = resolve(__dirname, "../../web/dist");
  if (existsSync(webDistDir)) {
    await app.register(fastifyStatic, {
      root: webDistDir,
      wildcard: false,
    });
    // SPA fallback: serve index.html for any non-API, non-WS route
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/") || req.url === "/ws") {
        reply.status(404).send({ error: "Not found" });
      } else {
        reply.sendFile("index.html");
      }
    });
  }

  // Initialize store (discover sessions, start tailing)
  await store.initialize();

  // Start listening
  await app.listen({ port, host });

  return { app, store, port, host };
}
