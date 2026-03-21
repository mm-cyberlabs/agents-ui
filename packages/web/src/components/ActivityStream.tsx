import { useRef, useEffect } from "react";
import type { ActivityEvent } from "@agents-ui/core/browser";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const EVENT_CONFIG: Record<
  ActivityEvent["type"],
  { icon: string; color: string }
> = {
  user_input: { icon: "👤", color: "text-blue-400" },
  text: { icon: "💬", color: "text-gray-300" },
  tool_start: { icon: "⚡", color: "text-yellow-400" },
  tool_end: { icon: "✓", color: "text-green-400" },
  subagent_start: { icon: "🔀", color: "text-cyan-400" },
  subagent_end: { icon: "🔙", color: "text-cyan-300" },
  compaction: { icon: "📦", color: "text-purple-400" },
  error: { icon: "✗", color: "text-red-400" },
};

function getDescription(evt: ActivityEvent): string {
  switch (evt.type) {
    case "user_input":
      return evt.data.text?.slice(0, 120) ?? "";
    case "text":
      return evt.data.text?.slice(0, 120) ?? "";
    case "tool_start":
      return evt.data.toolName ?? "";
    case "tool_end":
      return `${evt.data.toolName ?? ""}${evt.data.durationMs ? ` (${evt.data.durationMs}ms)` : ""}`;
    case "subagent_start":
      return `${evt.data.agentType ?? "Agent"}: ${evt.data.prompt?.slice(0, 80) ?? ""}`;
    case "subagent_end":
      return `Agent finished${evt.data.durationMs ? ` (${(evt.data.durationMs / 1000).toFixed(1)}s)` : ""}`;
    case "compaction":
      return "Context compacted";
    case "error":
      return evt.data.text ?? "Unknown error";
  }
}

export function ActivityStream({ events }: { events: ActivityEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-gray-600 text-sm">
        No activity yet. Waiting for events...
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-sm font-bold text-cyan-400">Activity Feed</h3>
      </div>
      <div ref={containerRef} className="max-h-96 overflow-y-auto p-2 space-y-0.5">
        {events.map((evt) => {
          const config = EVENT_CONFIG[evt.type];
          return (
            <div key={evt.id} className="flex items-start gap-2 text-xs py-0.5 font-mono">
              <span className="text-gray-600 shrink-0">{formatTime(evt.timestamp)}</span>
              <span className="shrink-0">{config.icon}</span>
              <span className={`${config.color} truncate`}>
                {getDescription(evt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
