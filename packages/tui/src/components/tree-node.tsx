import React from "react";
import { Box, Text } from "ink";
import type { AgentNode } from "@agents-ui/core";

interface TreeNodeProps {
  node: AgentNode;
  depth?: number;
  isLast?: boolean;
}

export function TreeNodeView({ node, depth = 0, isLast = true }: TreeNodeProps) {
  const prefix = depth === 0 ? "" : isLast ? "└── " : "├── ";
  const indent = depth === 0 ? "" : "│   ".repeat(depth - 1) + (depth > 0 ? "    " : "");

  const statusColor =
    node.status === "running" ? "green" : node.status === "error" ? "red" : "gray";

  const label = node.agentId === "root" ? "Main Agent" : node.agentType ?? node.agentId;

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{indent}{prefix}</Text>
        <Text color={statusColor} bold={node.status === "running"}>
          {label}
        </Text>
        {node.model && <Text dimColor> ({node.model})</Text>}
        {node.currentTool && (
          <Text color="yellow"> → {node.currentTool}</Text>
        )}
        {node.status === "completed" && node.durationMs && (
          <Text dimColor> {(node.durationMs / 1000).toFixed(1)}s</Text>
        )}
      </Box>
      {node.children.map((child, i) => (
        <TreeNodeView
          key={child.agentId}
          node={child}
          depth={depth + 1}
          isLast={i === node.children.length - 1}
        />
      ))}
    </Box>
  );
}
