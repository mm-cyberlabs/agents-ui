import { EventEmitter } from "eventemitter3";
import type { ServerMessage, ClientMessage } from "./types/ws-protocol.js";
import type { Session, ActivityEvent, AggregatedTokenUsage } from "./types/session.js";
import type { AgentNode } from "./types/agent-tree.js";

export interface WsClientEvents {
  connected: () => void;
  disconnected: () => void;
  "sessions:snapshot": (sessions: Session[]) => void;
  "session:updated": (session: Session) => void;
  "session:removed": (sessionId: string) => void;
  activity: (event: ActivityEvent) => void;
  "agent:updated": (sessionId: string, agentTree: AgentNode) => void;
  "tokens:updated": (sessionId: string, usage: AggregatedTokenUsage) => void;
  error: (error: Error) => void;
}

/**
 * Framework-agnostic WebSocket client for connecting to the agents-ui server.
 * Both TUI (Ink) and Web (React DOM) wrap this in their respective React hooks.
 */
export class WsClient extends EventEmitter<WsClientEvents> {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  private autoReconnect: boolean;

  constructor(url: string, autoReconnect = true) {
    super();
    this.url = url;
    this.autoReconnect = autoReconnect;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.emit("connected");
        this.send({ type: "subscribe", sessionIds: "all" });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(
            typeof event.data === "string" ? event.data : event.data.toString(),
          );
          this.handleMessage(msg);
        } catch (err) {
          this.emit("error", err instanceof Error ? err : new Error(String(err)));
        }
      };

      this.ws.onclose = () => {
        this.emit("disconnected");
        if (this.autoReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  disconnect(): void {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  subscribe(sessionIds: string[] | "all"): void {
    this.send({ type: "subscribe", sessionIds });
  }

  unsubscribe(sessionIds: string[]): void {
    this.send({ type: "unsubscribe", sessionIds });
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "sessions:snapshot":
        this.emit("sessions:snapshot", msg.sessions);
        break;
      case "session:updated":
        this.emit("session:updated", msg.session);
        break;
      case "session:removed":
        this.emit("session:removed", msg.sessionId);
        break;
      case "activity":
        this.emit("activity", msg.event);
        break;
      case "agent:updated":
        this.emit("agent:updated", msg.sessionId, msg.agentTree);
        break;
      case "tokens:updated":
        this.emit("tokens:updated", msg.sessionId, msg.usage);
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }
}
