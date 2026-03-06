import type { AggregatedTokenUsage } from "./session.js";

export type AgentStatus = "running" | "completed" | "error";

export interface AgentNode {
  agentId: string; // "root" for the main session agent
  sessionId: string;
  parentAgentId: string | null;
  agentType?: string; // e.g. "Explore", "Plan", "general-purpose", custom name
  model?: string;
  prompt?: string; // the prompt given to this agent
  status: AgentStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  tokenUsage: AggregatedTokenUsage;
  toolUseCount: number;
  currentTool?: string; // currently executing tool name (for live display)
  errorMessage?: string; // brief error from agent failure
  children: AgentNode[];
}

export function createRootAgent(sessionId: string, startedAt: string): AgentNode {
  return {
    agentId: "root",
    sessionId,
    parentAgentId: null,
    status: "running",
    startedAt,
    tokenUsage: createEmptyTokenUsage(),
    toolUseCount: 0,
    children: [],
  };
}

export function createEmptyTokenUsage(): AggregatedTokenUsage {
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    byModel: {},
    estimatedContextUsed: 0,
    contextWindowSize: 200_000,
    compactionCount: 0,
  };
}
