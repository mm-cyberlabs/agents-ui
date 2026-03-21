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
  orientation: "vertical" | "horizontal";
}

const CARD_W = 200;
const CARD_H = 80;
const H_GAP = 30;
const V_GAP = 50;

/**
 * Top-down tree layout. If the result is wider than `containerWidth`,
 * automatically switches to a left-to-right (horizontal) layout where
 * siblings stack vertically.
 */
export function computeTreeLayout(
  root: AgentNode,
  containerWidth?: number,
): TreeLayoutResult {
  const h = hierarchy(root, (d) => d.children);
  const nodeCount = h.descendants().length;

  if (nodeCount === 1) {
    const pad = 40;
    return {
      nodes: [{ node: root, x: pad + CARD_W / 2, y: pad + CARD_H / 2 }],
      edges: [],
      width: CARD_W + pad * 2,
      height: CARD_H + pad * 2,
      orientation: "vertical",
    };
  }

  // Try top-down (vertical) layout first
  const vertical = layoutTopDown(root);

  // If it fits or we don't know the container width, use vertical
  if (!containerWidth || vertical.width <= containerWidth) {
    return vertical;
  }

  // Too wide — switch to left-to-right (horizontal) layout
  return layoutLeftToRight(root);
}

/** Standard top-down layout: parent above, children spread horizontally */
function layoutTopDown(root: AgentNode): TreeLayoutResult {
  const h = hierarchy(root, (d) => d.children);

  const treeLayout = tree<AgentNode>()
    .nodeSize([CARD_W + H_GAP, CARD_H + V_GAP])
    .separation(() => 1);

  const treeData = treeLayout(h);
  const allDescendants = treeData.descendants();

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

  return { nodes, edges, width: totalWidth, height: totalHeight, orientation: "vertical" };
}

/** Left-to-right layout: parent on the left, children stacked vertically */
function layoutLeftToRight(root: AgentNode): TreeLayoutResult {
  const h = hierarchy(root, (d) => d.children);

  // d3.tree: x = perpendicular spread (vertical), y = depth (horizontal)
  const treeLayout = tree<AgentNode>()
    .nodeSize([CARD_H + V_GAP, CARD_W + H_GAP])
    .separation(() => 1);

  const treeData = treeLayout(h);
  const allDescendants = treeData.descendants();

  // d3 outputs: x = vertical position, y = depth (horizontal)
  // We use them as: screen x = d.y, screen y = d.x
  let minY = Infinity;
  let maxY = -Infinity;
  let maxX = -Infinity;
  for (const d of allDescendants) {
    const screenY = d.x; // vertical position
    const screenX = d.y; // horizontal depth
    if (screenY - CARD_H / 2 < minY) minY = screenY - CARD_H / 2;
    if (screenY + CARD_H / 2 > maxY) maxY = screenY + CARD_H / 2;
    if (screenX + CARD_W / 2 > maxX) maxX = screenX + CARD_W / 2;
  }

  const padX = 30;
  const padY = 30;
  const offsetY = -minY + padY;
  const totalWidth = maxX + padX * 2 + CARD_W / 2;
  const totalHeight = maxY - minY + padY * 2;

  const nodes: PositionedNode[] = allDescendants.map((d) => ({
    node: d.data,
    x: d.y + padX, // depth → horizontal
    y: d.x + offsetY, // spread → vertical
  }));

  const edges: PositionedEdge[] = treeData.links().map((link) => ({
    source: { x: link.source.y + padX, y: link.source.x + offsetY },
    target: { x: link.target.y + padX, y: link.target.x + offsetY },
    sourceNode: link.source.data,
    targetNode: link.target.data,
  }));

  return { nodes, edges, width: totalWidth, height: totalHeight, orientation: "horizontal" };
}

export { CARD_W, CARD_H };
