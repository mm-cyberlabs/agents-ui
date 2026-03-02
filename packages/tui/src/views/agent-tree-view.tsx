import React, { useMemo } from "react";
import { Box, Text, useStdout } from "ink";
import type { Session, AgentNode } from "@agents-ui/core";
import { getProjectDisplayName } from "@agents-ui/core";
import { flattenTree, FlatAgentRow } from "../components/tree-node.js";

function countAgents(node: AgentNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countAgents(c), 0);
}

function totalTokens(node: AgentNode): number {
  const own = node.tokenUsage.totalInputTokens + node.tokenUsage.totalOutputTokens;
  return own + node.children.reduce((sum, c) => sum + totalTokens(c), 0);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface AgentTreeViewProps {
  session: Session | null;
  scrollOffset: number;
}

// Each agent takes 2 lines (label row + stats row)
const LINES_PER_AGENT = 2;
// Header (2 lines) + footer (1 line) + tab bar area
const CHROME_LINES = 6;

export function AgentTreeView({ session, scrollOffset }: AgentTreeViewProps) {
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
  const subCount = agents.children.length;
  const agentCount = countAgents(agents);
  const tokens = totalTokens(agents);

  const flat = useMemo(() => flattenTree(agents), [agents]);

  // How many agents fit in the viewport
  const viewportLines = termRows - CHROME_LINES;
  const maxVisible = Math.max(1, Math.floor(viewportLines / LINES_PER_AGENT));
  const visible = flat.slice(scrollOffset, scrollOffset + maxVisible);
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + maxVisible < flat.length;

  return (
    <Box flexDirection="column" padding={1}>
      <Box gap={1} marginBottom={1}>
        <Text bold color="cyan">
          Agent Tree: {getProjectDisplayName(session.projectDir)}
        </Text>
        <Text dimColor>
          ({subCount} subagent{subCount !== 1 ? "s" : ""})
        </Text>
        {flat.length > maxVisible && (
          <Text dimColor>
            [{scrollOffset + 1}-{Math.min(scrollOffset + maxVisible, flat.length)}/{flat.length}]
          </Text>
        )}
      </Box>

      {canScrollUp && <Text dimColor>  ▲ more above</Text>}

      {visible.map((entry) => (
        <FlatAgentRow key={entry.node.agentId} entry={entry} />
      ))}

      {canScrollDown && <Text dimColor>  ▼ more below</Text>}

      <Box marginTop={1}>
        <Text dimColor>
          Total: {formatTokens(tokens)} tokens across {agentCount} agent{agentCount !== 1 ? "s" : ""}
        </Text>
      </Box>
    </Box>
  );
}

/** Calculate the max scroll offset for the current tree */
export function getMaxScroll(session: Session | null, termRows: number): number {
  if (!session) return 0;
  const flat = flattenTree(session.agentTree);
  const viewportLines = termRows - CHROME_LINES;
  const maxVisible = Math.max(1, Math.floor(viewportLines / LINES_PER_AGENT));
  return Math.max(0, flat.length - maxVisible);
}
