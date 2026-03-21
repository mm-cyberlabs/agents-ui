import { useState, useEffect, useRef, useCallback } from "react";
import type {
  Session,
  ActivityEvent,
  ServerMessage,
} from "@agents-ui/core/browser";

export interface UseWsResult {
  sessions: Map<string, Session>;
  activity: ActivityEvent[];
  connected: boolean;
  refresh: () => Promise<void>;
}

export function useWs(url: string): UseWsResult {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: "subscribe", sessionIds: "all" }));
      };

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);

          switch (msg.type) {
            case "sessions:snapshot": {
              const map = new Map<string, Session>();
              for (const s of msg.sessions) map.set(s.id, s);
              setSessions(map);
              break;
            }
            case "session:updated":
              setSessions((prev) => {
                const next = new Map(prev);
                next.set(msg.session.id, msg.session);
                return next;
              });
              break;
            case "session:removed":
              setSessions((prev) => {
                const next = new Map(prev);
                next.delete(msg.sessionId);
                return next;
              });
              break;
            case "activity":
              setActivity((prev) => {
                const next = [...prev, msg.event];
                return next.length > 1000 ? next.slice(-1000) : next;
              });
              break;
            case "agent:updated":
              setSessions((prev) => {
                const session = prev.get(msg.sessionId);
                if (!session) return prev;
                const next = new Map(prev);
                next.set(msg.sessionId, { ...session, agentTree: msg.agentTree });
                return next;
              });
              break;
            case "tokens:updated":
              setSessions((prev) => {
                const session = prev.get(msg.sessionId);
                if (!session) return prev;
                const next = new Map(prev);
                next.set(msg.sessionId, { ...session, tokenUsage: msg.usage });
                return next;
              });
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        // onclose fires after onerror
      };
    } catch {
      reconnectRef.current = setTimeout(connect, 2000);
    }
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const refresh = useCallback(async () => {
    // Tell server to re-scan sessions and re-evaluate statuses
    await fetch("/api/refresh", { method: "POST" }).catch(() => {});
    // Request fresh snapshot over WebSocket
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "get:sessions" }));
    }
  }, []);

  return { sessions, activity, connected, refresh };
}
