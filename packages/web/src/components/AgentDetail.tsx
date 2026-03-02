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
  text: { icon: "\u{1F4AC}", color: "var(--text-secondary)" },
  tool_start: { icon: "\u26A1", color: "#eab308" },
  tool_end: { icon: "\u2713", color: "#22c55e" },
  subagent_start: { icon: "\u{1F500}", color: "var(--accent)" },
  subagent_end: { icon: "\u{1F519}", color: "var(--accent-dim)" },
  compaction: { icon: "\u{1F4E6}", color: "var(--text-secondary)" },
  error: { icon: "\u2717", color: "#ef4444" },
};

function getDescription(evt: ActivityEvent): string {
  switch (evt.type) {
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

  const label = node.agentId === "root" ? "Main Agent" : node.agentType ?? node.agentId;
  const tokens = node.tokenUsage;
  const contextPct =
    tokens.contextWindowSize > 0
      ? Math.round((tokens.estimatedContextUsed / tokens.contextWindowSize) * 100)
      : 0;

  // Filter activity for this agent
  const agentActivity = useMemo(() => {
    if (node.agentId === "root") {
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
      <div
        className="rounded-xl shadow-2xl w-[700px] max-w-[90vw] max-h-[85vh] flex flex-col"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{label}</h2>
            <span
              className={`px-2 py-0.5 rounded text-xs border ${STATUS_BADGE[node.status]}`}
            >
              {node.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xl leading-none px-2 transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            &times;
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {node.model && (
              <div>
                <span style={{ color: "var(--text-muted)" }}>Model</span>
                <div className="font-mono" style={{ color: "var(--text-secondary)" }}>{node.model}</div>
              </div>
            )}
            <div>
              <span style={{ color: "var(--text-muted)" }}>Started</span>
              <div className="font-mono" style={{ color: "var(--text-secondary)" }}>{formatTime(node.startedAt)}</div>
            </div>
            {node.durationMs != null && (
              <div>
                <span style={{ color: "var(--text-muted)" }}>Duration</span>
                <div className="font-mono" style={{ color: "var(--text-secondary)" }}>{formatDuration(node.durationMs)}</div>
              </div>
            )}
            {node.currentTool && (
              <div>
                <span style={{ color: "var(--text-muted)" }}>Current Tool</span>
                <div className="text-yellow-400 font-mono">{node.currentTool}</div>
              </div>
            )}
          </div>

          {/* Token Usage */}
          <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: "var(--bg-surface)" }}>
            <h4 className="text-xs font-bold" style={{ color: "var(--accent)" }}>Token Usage</h4>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <span style={{ color: "var(--text-muted)" }}>Input</span>
                <div className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>{formatTokens(tokens.totalInputTokens)}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Output</span>
                <div className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>{formatTokens(tokens.totalOutputTokens)}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Cache Read</span>
                <div className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>{formatTokens(tokens.totalCacheReadTokens)}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Cache Write</span>
                <div className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>{formatTokens(tokens.totalCacheWriteTokens)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: "var(--text-muted)" }}>Context</span>
              <div className="flex-1 rounded-full h-2" style={{ backgroundColor: "var(--border-color)" }}>
                <div
                  className={`h-2 rounded-full ${contextPct < 50 ? "bg-green-500" : contextPct < 80 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(contextPct, 100)}%` }}
                />
              </div>
              <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{contextPct}%</span>
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {formatTokens(tokens.estimatedContextUsed)} / {formatTokens(tokens.contextWindowSize)}
              {tokens.compactionCount > 0 && (
                <span className="ml-2" style={{ color: "var(--text-secondary)" }}>({tokens.compactionCount} compactions)</span>
              )}
            </div>
          </div>

          {/* Prompt */}
          {node.prompt && (
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-surface)" }}>
              <h4 className="text-xs font-bold mb-1" style={{ color: "var(--accent)" }}>Prompt</h4>
              <pre className="text-xs whitespace-pre-wrap max-h-32 overflow-y-auto font-mono" style={{ color: "var(--text-secondary)" }}>
                {node.prompt}
              </pre>
            </div>
          )}

          {/* Children summary */}
          {node.children.length > 0 && (
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {node.children.length} subagent{node.children.length !== 1 ? "s" : ""} spawned
              ({node.children.filter((c) => c.status === "running").length} running)
            </div>
          )}

          {/* Activity Log */}
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--bg-surface)" }}>
            <div className="p-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <h4 className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                Activity Log ({agentActivity.length} events)
              </h4>
            </div>
            <div ref={logRef} className="max-h-60 overflow-y-auto p-2 space-y-0.5">
              {agentActivity.length === 0 ? (
                <div className="text-xs py-2 text-center" style={{ color: "var(--text-muted)" }}>No events for this agent</div>
              ) : (
                agentActivity.map((evt) => {
                  const config = EVENT_CONFIG[evt.type];
                  return (
                    <div key={evt.id} className="flex items-start gap-2 text-xs py-0.5 font-mono">
                      <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{formatTime(evt.timestamp)}</span>
                      <span className="shrink-0">{config.icon}</span>
                      <span className="break-words" style={{ color: config.color }}>
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
