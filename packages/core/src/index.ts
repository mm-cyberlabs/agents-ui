// Types
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

export type {
  InstalledAgent,
  InstalledSkill,
  InstalledConfig,
} from "./types/agent-config.js";

// Functions & classes
export { createRootAgent, createEmptyTokenUsage } from "./types/agent-tree.js";
export { parseJsonlLine, parseJsonlFile, parseJsonlFileAll } from "./parsers/jsonl-parser.js";
export { discoverSessions, discoverProjectSessions } from "./parsers/session-discovery.js";
export type { DiscoveredSession } from "./parsers/session-discovery.js";
export { AgentTreeBuilder } from "./parsers/agent-tree-builder.js";
export { accumulateTokens, createTokenUsage, mergeTokenUsage } from "./parsers/token-aggregator.js";
export { discoverInstalledConfig } from "./parsers/config-discovery.js";
export { JsonlTail } from "./watchers/jsonl-tail.js";
export type { JsonlTailEvents } from "./watchers/jsonl-tail.js";
export { SessionWatcher } from "./watchers/session-watcher.js";
export type { SessionWatcherEvents } from "./watchers/session-watcher.js";
export { WsClient } from "./ws-client.js";
export type { WsClientEvents } from "./ws-client.js";

// Utils
export {
  getClaudeDir,
  getProjectsDir,
  getHistoryPath,
  getSettingsPath,
  decodeProjectDir,
  getProjectDisplayName,
  getSubagentsDir,
} from "./utils/paths.js";
