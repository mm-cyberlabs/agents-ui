import React, { useMemo } from "react";
import { Box, Text, useStdout } from "ink";
import type { Session, AgentNode } from "@agents-ui/core";
import { getProjectDisplayName } from "@agents-ui/core";
import { flattenTree, FlatAgentRow } from "../components/tree-node.js";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.floor(s % 60)}s`;
}

interface AgentTreeViewProps {
  session: Session | null;
  selectedIndex: number;
}

// Each agent takes 2 lines (label row + stats row)
const LINES_PER_AGENT = 2;
// Header (2 lines) + footer (1 line) + tab bar area
const CHROME_LINES = 6;

export function AgentTreeView({ session, selectedIndex }: AgentTreeViewProps) {
  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 40;

  if (!session) {
    return (
      <Box padding={1}>
        <Text dimColor>Select a session to view its agent tree.</Text>
      </Box>
    );
  }

  const agents = session.agentTree;
  const flat = useMemo(() => flattenTree(agents), [agents]);

  // Auto-scroll viewport to keep selected agent visible
  const viewportLines = termRows - CHROME_LINES;
  const maxVisible = Math.max(1, Math.floor(viewportLines / LINES_PER_AGENT));

  const scrollOffset = useMemo(() => {
    if (selectedIndex < 0) return 0;
    // Keep selected agent within the visible window
    const idealStart = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
    const maxStart = Math.max(0, flat.length - maxVisible);
    return Math.min(idealStart, maxStart);
  }, [selectedIndex, maxVisible, flat.length]);

  const visible = flat.slice(scrollOffset, scrollOffset + maxVisible);
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + maxVisible < flat.length;

  const selectedNode = flat[selectedIndex]?.node ?? null;

  return (
    <Box flexDirection="row" width="100%">
      {/* Left: Agent tree */}
      <Box flexDirection="column" padding={1} width="50%">
        <Box gap={1} marginBottom={1}>
          <Text bold color="#E67D22">
            Agent Tree: {getProjectDisplayName(session.projectDir)}
          </Text>
          <Text dimColor>
            ({flat.length} agent{flat.length !== 1 ? "s" : ""})
          </Text>
        </Box>

        {canScrollUp && <Text dimColor>  ▲ more above</Text>}

        {visible.map((entry, i) => {
          const globalIndex = scrollOffset + i;
          return (
            <FlatAgentRow
              key={entry.node.agentId}
              entry={entry}
              selected={globalIndex === selectedIndex}
            />
          );
        })}

        {canScrollDown && <Text dimColor>  ▼ more below</Text>}
      </Box>

      {/* Right: Agent detail panel */}
      <Box
        flexDirection="column"
        width="50%"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        paddingY={0}
      >
        {selectedNode ? (
          <AgentDetail node={selectedNode} />
        ) : (
          <Text dimColor>No agent selected</Text>
        )}
      </Box>
    </Box>
  );
}

/** Agent detail panel */
function AgentDetail({ node }: { node: AgentNode }) {
  const label = node.agentId === "root" ? "Main Agent" : node.agentType ?? node.agentId;
  const inputTokens = node.tokenUsage.totalInputTokens;
  const outputTokens = node.tokenUsage.totalOutputTokens;
  const totalTok = inputTokens + outputTokens;
  const cacheRead = node.tokenUsage.totalCacheReadTokens;
  const cacheWrite = node.tokenUsage.totalCacheWriteTokens;
  const contextPct =
    node.tokenUsage.contextWindowSize > 0
      ? Math.round(
          (node.tokenUsage.estimatedContextUsed / node.tokenUsage.contextWindowSize) * 100,
        )
      : 0;

  const statusColor =
    node.status === "running" ? "green" : node.status === "error" ? "red" : "gray";
  const statusLabel =
    node.status === "running" ? "Running" : node.status === "error" ? "Error" : "Completed";

  return (
    <Box flexDirection="column">
      {/* Name */}
      <Box marginBottom={0}>
        <Text bold color="#E67D22">{label}</Text>
      </Box>

      {/* Status + Model */}
      <Box gap={1}>
        <Text dimColor>Status:</Text>
        <Text color={statusColor} bold>{statusLabel}</Text>
      </Box>
      {node.model && (
        <Box gap={1}>
          <Text dimColor>Model:</Text>
          <Text>{node.model}</Text>
        </Box>
      )}

      {/* Duration */}
      {node.durationMs != null && (
        <Box gap={1}>
          <Text dimColor>Duration:</Text>
          <Text>{formatDuration(node.durationMs)}</Text>
        </Box>
      )}
      {node.currentTool && (
        <Box gap={1}>
          <Text dimColor>Current tool:</Text>
          <Text color="yellow">{node.currentTool}</Text>
        </Box>
      )}

      {/* Tokens */}
      <Box marginTop={1} />
      <Text dimColor bold>Tokens</Text>
      <Box gap={1}>
        <Text dimColor>Total:</Text>
        <Text>{formatTokens(totalTok)}</Text>
      </Box>
      <Box gap={1}>
        <Text dimColor>Input:</Text>
        <Text>{formatTokens(inputTokens)}</Text>
        <Text dimColor>Output:</Text>
        <Text>{formatTokens(outputTokens)}</Text>
      </Box>
      {(cacheRead > 0 || cacheWrite > 0) && (
        <Box gap={1}>
          <Text dimColor>Cache R:</Text>
          <Text>{formatTokens(cacheRead)}</Text>
          <Text dimColor>W:</Text>
          <Text>{formatTokens(cacheWrite)}</Text>
        </Box>
      )}
      <Box gap={1}>
        <Text dimColor>Context:</Text>
        <Text color={contextPct < 50 ? "green" : contextPct < 80 ? "yellow" : "red"}>
          {contextPct}%
        </Text>
      </Box>

      {/* Tools */}
      <Box marginTop={1} />
      <Box gap={1}>
        <Text dimColor>Tools used:</Text>
        <Text>{node.toolUseCount}</Text>
      </Box>

      {/* Children */}
      {node.children.length > 0 && (
        <Box gap={1}>
          <Text dimColor>Subagents:</Text>
          <Text>{node.children.length}</Text>
        </Box>
      )}

      {/* Prompt (truncated) */}
      {node.prompt && (
        <>
          <Box marginTop={1} />
          <Text dimColor bold>Prompt</Text>
          <Text wrap="truncate-end">
            {node.prompt.length > 200 ? node.prompt.slice(0, 200) + "…" : node.prompt}
          </Text>
        </>
      )}
    </Box>
  );
}

/** Get the total number of agents in the flattened tree */
export function getAgentCount(session: Session | null): number {
  if (!session) return 0;
  return flattenTree(session.agentTree).length;
}
