import React from "react";
import { Box, Text } from "ink";
import type { Session, AgentNode } from "@agents-ui/core";
import { TreeNodeView } from "../components/tree-node.js";
import { getProjectDisplayName } from "@agents-ui/core";

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
}

export function AgentTreeView({ session }: AgentTreeViewProps) {
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

  return (
    <Box flexDirection="column" padding={1}>
      <Box gap={1} marginBottom={1}>
        <Text bold color="cyan">
          Agent Tree: {getProjectDisplayName(session.projectDir)}
        </Text>
        <Text dimColor>
          ({subCount} subagent{subCount !== 1 ? "s" : ""})
        </Text>
      </Box>
      <TreeNodeView node={agents} />
      <Box marginTop={1}>
        <Text dimColor>
          Total: {formatTokens(tokens)} tokens across {agentCount} agent{agentCount !== 1 ? "s" : ""}
        </Text>
      </Box>
    </Box>
  );
}
