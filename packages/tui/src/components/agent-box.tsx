import React from "react";
import { Box, Text } from "ink";
import type { AgentNode } from "@agents-ui/core";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function AgentBox({ node }: { node: AgentNode }) {
  const statusColor =
    node.status === "running" ? "green" : node.status === "error" ? "red" : "gray";
  const statusIcon = node.status === "running" ? "●" : node.status === "error" ? "✗" : "○";
  const label = node.agentId === "root" ? "Main Agent" : node.agentType ?? node.agentId;
  const tokens = node.tokenUsage.totalInputTokens + node.tokenUsage.totalOutputTokens;

  const contextPct =
    node.tokenUsage.contextWindowSize > 0
      ? Math.round(
          (node.tokenUsage.estimatedContextUsed / node.tokenUsage.contextWindowSize) * 100,
        )
      : 0;
  const barWidth = 12;
  const filled = Math.round((contextPct / 100) * barWidth);
  const barColor = contextPct < 50 ? "green" : contextPct < 80 ? "yellow" : "red";

  return (
    <Box
      borderStyle="single"
      borderColor={statusColor}
      flexDirection="column"
      paddingX={1}
      width={36}
    >
      <Box gap={1}>
        <Text color={statusColor} bold>
          {statusIcon}
        </Text>
        <Text color={statusColor} bold>
          {label}
        </Text>
        {node.status === "completed" && node.durationMs != null && (
          <Text dimColor>{(node.durationMs / 1000).toFixed(1)}s</Text>
        )}
      </Box>

      {node.model && <Text dimColor>  {node.model}</Text>}

      <Box gap={1}>
        <Text dimColor>  {formatTokens(tokens)} tok</Text>
        <Text dimColor>  {node.toolUseCount} tools</Text>
      </Box>

      {node.currentTool && (
        <Text color="yellow">  → {node.currentTool}</Text>
      )}

      <Box gap={1}>
        <Text dimColor>  ctx </Text>
        <Text color={barColor}>{"█".repeat(filled)}</Text>
        <Text dimColor>{"░".repeat(barWidth - filled)}</Text>
        <Text dimColor> {contextPct}%</Text>
      </Box>
    </Box>
  );
}
