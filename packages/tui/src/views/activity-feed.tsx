import React from "react";
import { Box, Text } from "ink";
import type { ActivityEvent } from "@agents-ui/core";

interface ActivityFeedProps {
  events: ActivityEvent[];
  maxLines?: number;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getEventIcon(type: ActivityEvent["type"]): { icon: string; color: string } {
  switch (type) {
    case "user_input":
      return { icon: "👤", color: "cyan" };
    case "text":
      return { icon: "💬", color: "white" };
    case "tool_start":
      return { icon: "⚡", color: "yellow" };
    case "tool_end":
      return { icon: "✓", color: "green" };
    case "subagent_start":
      return { icon: "🔀", color: "#E67D22" };
    case "subagent_end":
      return { icon: "🔙", color: "#E67D22" };
    case "compaction":
      return { icon: "📦", color: "magenta" };
    case "error":
      return { icon: "✗", color: "red" };
  }
}

export function ActivityFeed({ events, maxLines = 30 }: ActivityFeedProps) {
  const visible = events.slice(-maxLines);

  if (visible.length === 0) {
    return (
      <Box padding={1}>
        <Text dimColor>No activity yet. Waiting for events...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="#E67D22">Activity Feed</Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.map((evt) => {
          const { icon, color } = getEventIcon(evt.type);
          let description = "";

          switch (evt.type) {
            case "user_input":
              description = evt.data.text?.slice(0, 80) ?? "";
              break;
            case "text":
              description = evt.data.text?.slice(0, 80) ?? "";
              break;
            case "tool_start":
              description = `${evt.data.toolName}`;
              break;
            case "tool_end":
              description = `${evt.data.toolName}${evt.data.durationMs ? ` (${evt.data.durationMs}ms)` : ""}`;
              break;
            case "subagent_start":
              description = `${evt.data.agentType ?? "Agent"}: ${evt.data.prompt?.slice(0, 60) ?? ""}`;
              break;
            case "subagent_end":
              description = `Agent finished${evt.data.durationMs ? ` (${(evt.data.durationMs / 1000).toFixed(1)}s)` : ""}`;
              break;
            case "compaction":
              description = "Context compacted";
              break;
            case "error":
              description = evt.data.text ?? "Unknown error";
              break;
          }

          return (
            <Box key={evt.id} gap={1}>
              <Text dimColor>{formatTime(evt.timestamp)}</Text>
              <Text color={color}>{icon}</Text>
              <Text wrap="truncate">{description}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
