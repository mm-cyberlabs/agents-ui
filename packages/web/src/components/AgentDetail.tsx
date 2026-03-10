import { useRef, useEffect, useMemo } from "react";
import type { AgentNode, ActivityEvent } from "@agents-ui/core/browser";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

const STATUS_BADGE: Record<string, string> = {
  running: "bg-green-500/20 text-green-400 border-green-500/40",
  completed: "bg-gray-500/20 text-gray-400 border-gray-500/40",
  error: "bg-red-500/20 text-red-400 border-red-500/40",
};

const EVENT_CONFIG: Record<ActivityEvent["type"], { icon: string; color: string }> = {
  user_input: { icon: "\u{1F464}", color: "text-blue-400" },
  text: { icon: "\u{1F4AC}", color: "text-gray-300" },
  tool_start: { icon: "\u26A1", color: "text-yellow-400" },
  tool_end: { icon: "\u2713", color: "text-green-400" },
  subagent_start: { icon: "\u{1F500}", color: "text-cyan-400" },
  subagent_end: { icon: "\u{1F519}", color: "text-cyan-300" },
  compaction: { icon: "\u{1F4E6}", color: "text-purple-400" },
  error: { icon: "\u2717", color: "text-red-400" },
};

function getDescription(evt: ActivityEvent): string {
  switch (evt.type) {
    case "user_input":
      return evt.data.text?.slice(0, 200) ?? "";
    case "text":
      return evt.data.text?.slice(0, 200) ?? "";
    case "tool_start":
      return evt.data.toolName ?? "";
    case "tool_end":
      return `${evt.data.toolName ?? ""}${evt.data.durationMs ? ` (${evt.data.durationMs}ms)` : ""}`;
    case "subagent_start":
      return `${evt.data.agentType ?? "Agent"}: ${evt.data.prompt?.slice(0, 120) ?? ""}`;
    case "subagent_end":
      return `Agent finished${evt.data.durationMs ? ` (${formatDuration(evt.data.durationMs)})` : ""}`;
    case "compaction":
      return "Context compacted";
    case "error":
      return evt.data.text ?? "Unknown error";
  }
}

interface AgentDetailProps {
  node: AgentNode;
  activity: ActivityEvent[];
  onClose: () => void;
}

export function AgentDetail({ node, activity, onClose }: AgentDetailProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const label = node.agentId === "root" ? "Main Agent" : node.name ?? node.agentType ?? node.agentId;
  const tokens = node.tokenUsage;
  const totalTokens = tokens.totalInputTokens + tokens.totalOutputTokens;
  const contextPct =
    tokens.contextWindowSize > 0
      ? Math.round((tokens.estimatedContextUsed / tokens.contextWindowSize) * 100)
      : 0;

  // Filter activity for this agent
  const agentActivity = useMemo(() => {
    if (node.agentId === "root") {
      // Root agent: events with no agentId or agentId === "root"
      return activity.filter((e) => !e.agentId || e.agentId === "root");
    }
    return activity.filter((e) => e.agentId === node.agentId);
  }, [activity, node.agentId]);

  // Auto-scroll log
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [agentActivity.length]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[700px] max-w-[90vw] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">{label}</h2>
            <span
              className={`px-2 py-0.5 rounded text-xs border ${STATUS_BADGE[node.status]}`}
            >
              {node.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none px-2"
          >
            &times;
          </button>
        </div>

        {/* Error message */}
        {node.status === "error" && node.errorMessage && (
          <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <pre className="text-xs text-red-400 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
              {node.errorMessage}
            </pre>
          </div>
        )}

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {node.model && (
              <div>
                <span className="text-gray-500">Model</span>
                <div className="text-gray-200 font-mono">{node.model}</div>
              </div>
            )}
            <div>
              <span className="text-gray-500">Started</span>
              <div className="text-gray-200 font-mono">{formatTime(node.startedAt)}</div>
            </div>
            {node.durationMs != null && (
              <div>
                <span className="text-gray-500">Duration</span>
                <div className="text-gray-200 font-mono">{formatDuration(node.durationMs)}</div>
              </div>
            )}
            {node.currentTool && (
              <div>
                <span className="text-gray-500">Current Tool</span>
                <div className="text-yellow-400 font-mono">{node.currentTool}</div>
              </div>
            )}
          </div>

          {/* Token Usage */}
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-bold text-cyan-400">Token Usage</h4>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Input</span>
                <div className="text-white font-mono font-bold">{formatTokens(tokens.totalInputTokens)}</div>
              </div>
              <div>
                <span className="text-gray-500">Output</span>
                <div className="text-white font-mono font-bold">{formatTokens(tokens.totalOutputTokens)}</div>
              </div>
              <div>
                <span className="text-gray-500">Cache Read</span>
                <div className="text-white font-mono font-bold">{formatTokens(tokens.totalCacheReadTokens)}</div>
              </div>
              <div>
                <span className="text-gray-500">Cache Write</span>
                <div className="text-white font-mono font-bold">{formatTokens(tokens.totalCacheWriteTokens)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Context</span>
              <div className="flex-1 bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${contextPct < 50 ? "bg-green-500" : contextPct < 80 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(contextPct, 100)}%` }}
                />
              </div>
              <span className="text-gray-400 font-mono">{contextPct}%</span>
            </div>
            <div className="text-xs text-gray-500">
              {formatTokens(tokens.estimatedContextUsed)} / {formatTokens(tokens.contextWindowSize)}
              {tokens.compactionCount > 0 && (
                <span className="text-purple-400 ml-2">({tokens.compactionCount} compactions)</span>
              )}
            </div>
          </div>

          {/* Prompt */}
          {node.prompt && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <h4 className="text-xs font-bold text-cyan-400 mb-1">Prompt</h4>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
                {node.prompt}
              </pre>
            </div>
          )}

          {/* Children summary */}
          {node.children.length > 0 && (
            <div className="text-xs text-gray-500">
              {node.children.length} subagent{node.children.length !== 1 ? "s" : ""} spawned
              ({node.children.filter((c) => c.status === "running").length} running)
            </div>
          )}

          {/* Activity Log */}
          <div className="bg-gray-800/50 rounded-lg overflow-hidden">
            <div className="p-2 border-b border-gray-700">
              <h4 className="text-xs font-bold text-cyan-400">
                Activity Log ({agentActivity.length} events)
              </h4>
            </div>
            <div ref={logRef} className="max-h-60 overflow-y-auto p-2 space-y-0.5">
              {agentActivity.length === 0 ? (
                <div className="text-xs text-gray-600 py-2 text-center">No events for this agent</div>
              ) : (
                agentActivity.map((evt) => {
                  const config = EVENT_CONFIG[evt.type];
                  return (
                    <div key={evt.id} className="flex items-start gap-2 text-xs py-0.5 font-mono">
                      <span className="text-gray-600 shrink-0">{formatTime(evt.timestamp)}</span>
                      <span className="shrink-0">{config.icon}</span>
                      <span className={`${config.color} break-words`}>
                        {getDescription(evt)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
