import React from "react";
import { Box, Text } from "ink";
import type { AgentNode } from "@agents-ui/core";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Compact 2-line agent row: fits many agents on screen.
 * Line 1: status icon + label + model + duration/current tool
 * Line 2: tokens + tools + context bar
 */
export function AgentRow({ node, selected }: { node: AgentNode; selected?: boolean }) {
  const statusColor =
    node.status === "running" ? "green" : node.status === "error" ? "red" : "gray";
  const statusIcon = node.status === "running" ? "●" : node.status === "error" ? "✗" : "○";
  const label = node.agentId === "root" ? "Main Agent" : node.name ?? node.agentType ?? node.agentId;
  const tokens = node.tokenUsage.totalInputTokens + node.tokenUsage.totalOutputTokens;

  const contextPct =
    node.tokenUsage.contextWindowSize > 0
      ? Math.round(
          (node.tokenUsage.estimatedContextUsed / node.tokenUsage.contextWindowSize) * 100,
        )
      : 0;
  const barWidth = 10;
  const filled = Math.round((contextPct / 100) * barWidth);
  const barColor = contextPct < 50 ? "green" : contextPct < 80 ? "yellow" : "red";

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={selected ? "#E67D22" : statusColor} bold>{selected ? "▸" : statusIcon}</Text>
        <Text color={selected ? "#E67D22" : statusColor} bold>{label}</Text>
        {node.model && <Text dimColor>({node.model})</Text>}
        {node.currentTool && <Text color="yellow"> → {node.currentTool}</Text>}
        {node.status === "completed" && node.durationMs != null && (
          <Text dimColor> {(node.durationMs / 1000).toFixed(1)}s</Text>
        )}
      </Box>
      <Box gap={1}>
        <Text dimColor>  {formatTokens(tokens)} tok</Text>
        <Text dimColor>{node.toolUseCount} tools</Text>
        <Text color={barColor}>{"█".repeat(filled)}</Text>
        <Text dimColor>{"░".repeat(barWidth - filled)}</Text>
        <Text dimColor>{contextPct}%</Text>
      </Box>
    </Box>
  );
}
