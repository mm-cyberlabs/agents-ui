import React from "react";
import { Box, Text } from "ink";
import type { AgentNode } from "@agents-ui/core";
import { AgentRow } from "./agent-box.js";

/**
 * Flattened tree entry for scrollable display.
 */
export interface FlatAgent {
  node: AgentNode;
  depth: number;
  prefix: string;     // tree-drawing prefix (│   , etc.)
  connector: string;  // ├── or └──
}

/**
 * Flatten the agent tree into a list with tree-drawing prefixes.
 */
export function flattenTree(
  node: AgentNode,
  depth = 0,
  prefix = "",
  isLast = true,
): FlatAgent[] {
  const connector = depth === 0 ? "" : isLast ? "└─ " : "├─ ";
  const childPrefix = depth === 0 ? "" : prefix + (isLast ? "   " : "│  ");
  const result: FlatAgent[] = [{ node, depth, prefix, connector }];

  node.children.forEach((child, i) => {
    result.push(
      ...flattenTree(child, depth + 1, childPrefix, i === node.children.length - 1),
    );
  });

  return result;
}

/**
 * Render a single flat agent row with its tree connector.
 */
export function FlatAgentRow({ entry, selected }: { entry: FlatAgent; selected?: boolean }) {
  return (
    <Box>
      {entry.depth > 0 && <Text dimColor>{entry.prefix}{entry.connector}</Text>}
      <AgentRow node={entry.node} selected={selected} />
    </Box>
  );
}
