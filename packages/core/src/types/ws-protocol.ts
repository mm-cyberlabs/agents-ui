import type { Session, ActivityEvent, AggregatedTokenUsage } from "./session.js";
import type { AgentNode } from "./agent-tree.js";

// Server -> Client
export type ServerMessage =
  | { type: "sessions:snapshot"; sessions: Session[] }
  | { type: "session:updated"; session: Session }
  | { type: "session:removed"; sessionId: string }
  | { type: "activity"; event: ActivityEvent }
  | { type: "agent:updated"; sessionId: string; agentTree: AgentNode }
  | { type: "tokens:updated"; sessionId: string; usage: AggregatedTokenUsage };

// Client -> Server
export type ClientMessage =
  | { type: "subscribe"; sessionIds: string[] | "all" }
  | { type: "unsubscribe"; sessionIds: string[] }
  | { type: "get:sessions" }
  | { type: "get:session"; sessionId: string };
