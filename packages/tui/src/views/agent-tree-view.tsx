import React from "react";
import { Box, Text } from "ink";
import type { Session } from "@agents-ui/core";
import { TreeNodeView } from "../components/tree-node.js";
import { getProjectDisplayName } from "@agents-ui/core";

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
    </Box>
  );
}
