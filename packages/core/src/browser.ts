// Browser-safe exports: types only + pure utility functions (no Node.js APIs)

export type {
  JsonlLine,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ProgressMessage,
  QueueOperation,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  ImageBlock,
  ContentBlock,
  TokenUsage,
  SubagentResult,
  BaseMessageFields,
} from "./types/jsonl.js";

export type {
  Session,
  SessionStatus,
  AggregatedTokenUsage,
  ActivityEvent,
  ActivityEventType,
} from "./types/session.js";

export type {
  AgentNode,
  AgentStatus,
} from "./types/agent-tree.js";

export type {
  HookEvent,
  HookEventType,
  HookEventBase,
  SessionStartEvent,
  SessionEndEvent,
  PreToolUseEvent,
  PostToolUseEvent,
  PostToolUseFailureEvent,
  SubagentStartEvent,
  SubagentStopEvent,
  StopEvent,
  PreCompactEvent,
  UserPromptSubmitEvent,
  NotificationEvent,
} from "./types/hooks.js";

export type {
  ServerMessage,
  ClientMessage,
} from "./types/ws-protocol.js";

// Pure functions (no Node.js deps)

/**
 * Decode an encoded project directory name back to the original absolute path.
 */
export function decodeProjectDir(encoded: string): string {
  if (!encoded.startsWith("-")) return encoded;
  return encoded.replace(/-/g, "/");
}

/**
 * Get a display-friendly project name from an encoded directory name.
 */
export function getProjectDisplayName(encoded: string): string {
  const decoded = decodeProjectDir(encoded);
  const segments = decoded.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? encoded;
}
