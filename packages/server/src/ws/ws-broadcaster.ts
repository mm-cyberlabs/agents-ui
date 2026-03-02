import type { WebSocket } from "ws";
import type { ServerMessage, ClientMessage } from "@agents-ui/core";
import { SessionStore } from "../state/session-store.js";

interface ConnectedClient {
  ws: WebSocket;
  subscriptions: Set<string> | "all";
}

export class WsBroadcaster {
  private clients = new Set<ConnectedClient>();

  constructor(private store: SessionStore) {
    // Wire up store events to broadcast
    store.on("session:updated", (session) => {
      this.broadcast({ type: "session:updated", session }, session.id);
    });

    store.on("session:removed", (sessionId) => {
      this.broadcast({ type: "session:removed", sessionId }, sessionId);
    });

    store.on("activity", (event) => {
      this.broadcast({ type: "activity", event }, event.sessionId);
    });

    store.on("agent:updated", (sessionId, agentTree) => {
      this.broadcast({ type: "agent:updated", sessionId, agentTree }, sessionId);
    });

    store.on("tokens:updated", (sessionId, usage) => {
      this.broadcast({ type: "tokens:updated", sessionId, usage }, sessionId);
    });
  }

  addClient(ws: WebSocket): void {
    const client: ConnectedClient = { ws, subscriptions: "all" };
    this.clients.add(client);

    // Send initial snapshot
    const snapshot: ServerMessage = {
      type: "sessions:snapshot",
      sessions: this.store.getSessions(),
    };
    ws.send(JSON.stringify(snapshot));

    ws.on("message", (data) => {
      try {
        const msg: ClientMessage = JSON.parse(data.toString());
        this.handleClientMessage(client, msg);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      this.clients.delete(client);
    });
  }

  private handleClientMessage(client: ConnectedClient, msg: ClientMessage): void {
    switch (msg.type) {
      case "subscribe":
        client.subscriptions = msg.sessionIds === "all" ? "all" : new Set(msg.sessionIds);
        break;
      case "unsubscribe":
        if (client.subscriptions !== "all") {
          for (const id of msg.sessionIds) {
            client.subscriptions.delete(id);
          }
        }
        break;
      case "get:sessions": {
        const snapshot: ServerMessage = {
          type: "sessions:snapshot",
          sessions: this.store.getSessions(),
        };
        client.ws.send(JSON.stringify(snapshot));
        break;
      }
      case "get:session": {
        const session = this.store.getSession(msg.sessionId);
        if (session) {
          const update: ServerMessage = { type: "session:updated", session };
          client.ws.send(JSON.stringify(update));
        }
        break;
      }
    }
  }

  private broadcast(msg: ServerMessage, sessionId: string): void {
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.ws.readyState !== 1) continue; // OPEN
      if (
        client.subscriptions === "all" ||
        client.subscriptions.has(sessionId)
      ) {
        client.ws.send(data);
      }
    }
  }
}
