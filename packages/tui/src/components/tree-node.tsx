import React from "react";
import { Box, Text } from "ink";
import type { AgentNode } from "@agents-ui/core";
import { AgentBox } from "./agent-box.js";

interface TreeNodeProps {
  node: AgentNode;
  depth?: number;
  isLast?: boolean;
  prefix?: string;
}

export function TreeNodeView({
  node,
  depth = 0,
  isLast = true,
  prefix = "",
}: TreeNodeProps) {
  const connector = depth === 0 ? "" : isLast ? "└── " : "├── ";
  const childPrefix = depth === 0 ? "" : prefix + (isLast ? "    " : "│   ");

  return (
    <Box flexDirection="column">
      <Box>
        {depth > 0 && <Text dimColor>{prefix}{connector}</Text>}
        <AgentBox node={node} />
      </Box>
      {node.children.map((child, i) => (
        <TreeNodeView
          key={child.agentId}
          node={child}
          depth={depth + 1}
          isLast={i === node.children.length - 1}
          prefix={childPrefix}
        />
      ))}
    </Box>
  );
}
