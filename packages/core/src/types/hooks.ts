export type HookEventType =
  | "SessionStart"
  | "SessionEnd"
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "SubagentStart"
  | "SubagentStop"
  | "Stop"
  | "Notification"
  | "UserPromptSubmit"
  | "PreCompact";

export interface HookEventBase {
  type: HookEventType;
  session_id: string;
  timestamp?: string;
}

export interface SessionStartEvent extends HookEventBase {
  type: "SessionStart";
  trigger: "startup" | "resume" | "clear" | "compact";
  cwd: string;
}

export interface SessionEndEvent extends HookEventBase {
  type: "SessionEnd";
  exit_reason?: string;
}

export interface PreToolUseEvent extends HookEventBase {
  type: "PreToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id?: string;
}

export interface PostToolUseEvent extends HookEventBase {
  type: "PostToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_result?: string;
  tool_use_id?: string;
  duration_ms?: number;
}

export interface PostToolUseFailureEvent extends HookEventBase {
  type: "PostToolUseFailure";
  tool_name: string;
  tool_input: Record<string, unknown>;
  error?: string;
  tool_use_id?: string;
}

export interface SubagentStartEvent extends HookEventBase {
  type: "SubagentStart";
  agent_type?: string;
  agent_id?: string;
  prompt?: string;
  model?: string;
}

export interface SubagentStopEvent extends HookEventBase {
  type: "SubagentStop";
  agent_type?: string;
  agent_id?: string;
  status?: "completed" | "error";
  total_tokens?: number;
  total_tool_use_count?: number;
  duration_ms?: number;
}

export interface StopEvent extends HookEventBase {
  type: "Stop";
  stop_reason?: string;
}

export interface PreCompactEvent extends HookEventBase {
  type: "PreCompact";
  trigger: "manual" | "auto";
  pre_tokens?: number;
}

export interface UserPromptSubmitEvent extends HookEventBase {
  type: "UserPromptSubmit";
  prompt?: string;
}

export interface NotificationEvent extends HookEventBase {
  type: "Notification";
  notification_type?: string;
  message?: string;
}

export type HookEvent =
  | SessionStartEvent
  | SessionEndEvent
  | PreToolUseEvent
  | PostToolUseEvent
  | PostToolUseFailureEvent
  | SubagentStartEvent
  | SubagentStopEvent
  | StopEvent
  | PreCompactEvent
  | UserPromptSubmitEvent
  | NotificationEvent;
