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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div
        className="rounded-lg p-4 text-sm"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
      >
        No activity yet. Waiting for events...
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <div className="p-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--accent)" }}>Activity Feed</h3>
      </div>
      <div className="max-h-96 overflow-y-auto p-2 space-y-0.5">
        {events.map((evt) => {
          const config = EVENT_CONFIG[evt.type];
          return (
            <div key={evt.id} className="flex items-start gap-2 text-xs py-0.5 font-mono">
              <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{formatTime(evt.timestamp)}</span>
              <span className="shrink-0">{config.icon}</span>
              <span className="truncate" style={{ color: config.color }}>
                {getDescription(evt)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
