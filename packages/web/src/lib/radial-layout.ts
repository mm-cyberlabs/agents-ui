import { hierarchy, tree } from "d3-hierarchy";
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

const CARD_W = 160;
const CARD_H = 72;
const H_GAP = 40;
const V_GAP = 60;

/**
 * Top-down tree layout. Returns positioned nodes/edges and the total
 * bounding box so the SVG can size itself to fit all content.
 */
export function computeTreeLayout(root: AgentNode): TreeLayoutResult {
  const h = hierarchy(root, (d) => d.children);
  const nodeCount = h.descendants().length;

  if (nodeCount === 1) {
    const pad = 40;
    return {
      nodes: [{ node: root, x: pad + CARD_W / 2, y: pad + CARD_H / 2 }],
      edges: [],
      width: CARD_W + pad * 2,
      height: CARD_H + pad * 2,
    };
  }

  // d3.tree lays out in a unit space: x = horizontal spread, y = depth
  const treeLayout = tree<AgentNode>()
    .nodeSize([CARD_W + H_GAP, CARD_H + V_GAP])
    .separation(() => 1);

  const treeData = treeLayout(h);
  const allDescendants = treeData.descendants();

  // Find bounding box of all nodes
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of allDescendants) {
    if (d.x - CARD_W / 2 < minX) minX = d.x - CARD_W / 2;
    if (d.x + CARD_W / 2 > maxX) maxX = d.x + CARD_W / 2;
    if (d.y + CARD_H / 2 > maxY) maxY = d.y + CARD_H / 2;
  }

  const padX = 30;
  const padY = 30;
  const offsetX = -minX + padX;
  const totalWidth = maxX - minX + padX * 2;
  const totalHeight = maxY + padY * 2 + CARD_H / 2;

  const nodes: PositionedNode[] = allDescendants.map((d) => ({
    node: d.data,
    x: d.x + offsetX,
    y: d.y + padY,
  }));

  const edges: PositionedEdge[] = treeData.links().map((link) => ({
    source: { x: link.source.x + offsetX, y: link.source.y + padY },
    target: { x: link.target.x + offsetX, y: link.target.y + padY },
    sourceNode: link.source.data,
    targetNode: link.target.data,
  }));

  return { nodes, edges, width: totalWidth, height: totalHeight };
}

export { CARD_W, CARD_H };
