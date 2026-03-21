import type { AgentNode } from "@agents-ui/core/browser";

export interface PositionedNode {
  node: AgentNode;
  x: number;
  y: number;
}

export interface PositionedEdge {
  source: { x: number; y: number };
  target: { x: number; y: number };
  sourceNode: AgentNode;
  targetNode: AgentNode;
}

export interface TreeLayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

const CARD_W = 200;
const CARD_H = 80;
const H_GAP = 30;
const V_GAP = 50;

/**
 * Tree layout that wraps children into rows when they'd overflow the
 * container width. Cards are always full-size — the layout grows
 * vertically instead of scaling down.
 *
 * Children are laid out horizontally left-to-right, wrapping to a new
 * row below when the next card wouldn't fit. Each depth level's rows
 * are placed below the previous level.
 */
export function computeTreeLayout(
  root: AgentNode,
  containerWidth?: number,
): TreeLayoutResult {
  const pad = 30;
  const cw = Math.max(containerWidth ?? 800, CARD_W + pad * 2);
  const usableWidth = cw - pad * 2;
  const maxPerRow = Math.max(1, Math.floor((usableWidth + H_GAP) / (CARD_W + H_GAP)));

  // BFS to collect nodes by depth level
  const levels: AgentNode[][] = [];
  const queue: { node: AgentNode; depth: number }[] = [{ node: root, depth: 0 }];

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(node);
    for (const child of node.children) {
      queue.push({ node: child, depth: depth + 1 });
    }
  }

  // Position each level with wrapping rows
  const placed = new Map<AgentNode, { x: number; y: number }>();
  let currentY = pad + CARD_H / 2;

  for (const level of levels) {
    const numRows = Math.ceil(level.length / maxPerRow);

    for (let row = 0; row < numRows; row++) {
      const start = row * maxPerRow;
      const end = Math.min(start + maxPerRow, level.length);
      const rowCount = end - start;

      // Center this row within the container
      const rowWidth = rowCount * CARD_W + (rowCount - 1) * H_GAP;
      const startX = pad + (usableWidth - rowWidth) / 2 + CARD_W / 2;

      for (let i = start; i < end; i++) {
        const col = i - start;
        const cx = startX + col * (CARD_W + H_GAP);
        placed.set(level[i], { x: cx, y: currentY });
      }

      currentY += CARD_H + V_GAP;
    }
  }

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  for (const [node, pos] of placed) {
    nodes.push({ node, x: pos.x, y: pos.y });
  }

  // Build edges by walking the tree
  const walkEdges = (node: AgentNode) => {
    const parentPos = placed.get(node);
    if (!parentPos) return;
    for (const child of node.children) {
      const childPos = placed.get(child);
      if (!childPos) continue;
      edges.push({
        source: { x: parentPos.x, y: parentPos.y },
        target: { x: childPos.x, y: childPos.y },
        sourceNode: node,
        targetNode: child,
      });
      walkEdges(child);
    }
  };
  walkEdges(root);

  const totalHeight = currentY - V_GAP + CARD_H / 2 + pad;
  const totalWidth = Math.max(
    cw,
    ...nodes.map((n) => n.x + CARD_W / 2 + pad),
  );

  return { nodes, edges, width: totalWidth, height: totalHeight };
}

export { CARD_W, CARD_H };
