// Types matching the real Claude Code JSONL transcript format

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation?: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  service_tier?: string;
  inference_geo?: string;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
  caller?: { type: string };
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | TextBlock[];
  is_error?: boolean;
}

export interface ImageBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ImageBlock;

// Fields shared by all message types (except queue-operation)
export interface BaseMessageFields {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: "external" | "internal";
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
  slug?: string;
  uuid: string;
  timestamp: string;
}

export interface SubagentResult {
  status: "completed" | "error";
  prompt: string;
  agentId: string;
  content: string;
  totalDurationMs: string;
  totalTokens: string;
  totalToolUseCount: string;
  usage: string; // stringified JSON
}

export interface UserMessage extends BaseMessageFields {
  type: "user";
  permissionMode?: string;
  message: {
    role: "user";
    content: string | ContentBlock[];
  };
  toolUseResult?: SubagentResult;
  sourceToolAssistantUUID?: string;
  isMeta?: boolean;
}

export interface AssistantMessage extends BaseMessageFields {
  type: "assistant";
  requestId?: string;
  message: {
    role: "assistant";
    content: ContentBlock[];
    model?: string;
    id?: string;
    type?: string;
    usage?: TokenUsage;
    stop_reason?: string;
  };
}

export interface SystemMessage extends BaseMessageFields {
  type: "system";
  subtype: string;
  compactMetadata?: {
    trigger: string;
    preTokens: number;
  };
  hookCount?: number;
  hookInfos?: Array<{ command: string }>;
  hookErrors?: string[];
  preventedContinuation?: boolean;
  stopReason?: string;
  level?: string;
  toolUseID?: string;
}

export interface ProgressMessage extends BaseMessageFields {
  type: "progress";
  data: {
    type: string;
    hookEvent?: string;
    hookName?: string;
    command?: string;
  };
  parentToolUseID?: string;
  toolUseID?: string;
}

export interface QueueOperation {
  type: "queue-operation";
  operation: "enqueue" | "dequeue";
  timestamp: string;
  sessionId: string;
  content?: string;
}

export type JsonlLine =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | ProgressMessage
  | QueueOperation;
