import type { AgentNode } from "./agent-tree.js";

export type SessionStatus = "active" | "idle" | "completed";

export interface AggregatedTokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  byModel: Record<string, { inputTokens: number; outputTokens: number }>;
  estimatedContextUsed: number;
  contextWindowSize: number;
  compactionCount: number;
}

export type ActivityEventType =
  | "text"
  | "tool_start"
  | "tool_end"
  | "subagent_start"
  | "subagent_end"
  | "compaction"
  | "error";

export interface ActivityEvent {
  id: string; // unique event id
  type: ActivityEventType;
  timestamp: string;
  sessionId: string;
  agentId?: string; // undefined for root agent
  data: {
    text?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolResult?: string;
    durationMs?: number;
    agentType?: string;
    prompt?: string;
    model?: string;
  };
}

export interface Session {
  id: string;
  slug?: string;
  projectPath: string;
  projectDir: string; // encoded dir name
  cwd: string;
  gitBranch: string;
  version: string;
  model?: string;
  status: SessionStatus;
  startedAt: string;
  lastActivityAt: string;
  messageCount: number;
  tokenUsage: AggregatedTokenUsage;
  agentTree: AgentNode;
  recentActivity: ActivityEvent[];
}
