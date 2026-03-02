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

export function computeRadialLayout(
  root: AgentNode,
  width: number,
  height: number,
): { nodes: PositionedNode[]; edges: PositionedEdge[] } {
  const h = hierarchy(root, (d) => d.children);
  const radius = Math.min(width, height) / 2 - 80;

  // Single node — just place at center
  if (h.descendants().length === 1) {
    return {
      nodes: [{ node: root, x: width / 2, y: height / 2 }],
      edges: [],
    };
  }

  const treeLayout = tree<AgentNode>()
    .size([2 * Math.PI, Math.max(radius, 60)])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / (a.depth || 1));

  const treeData = treeLayout(h);
  const cx = width / 2;
  const cy = height / 2;

  const nodes: PositionedNode[] = treeData.descendants().map((d) => {
    // Root goes to center, children project radially
    if (d.depth === 0) {
      return { node: d.data, x: cx, y: cy };
    }
    return {
      node: d.data,
      x: d.y * Math.cos(d.x - Math.PI / 2) + cx,
      y: d.y * Math.sin(d.x - Math.PI / 2) + cy,
    };
  });

  const edges: PositionedEdge[] = treeData.links().map((link) => {
    const sx = link.source.depth === 0 ? cx : link.source.y * Math.cos(link.source.x - Math.PI / 2) + cx;
    const sy = link.source.depth === 0 ? cy : link.source.y * Math.sin(link.source.x - Math.PI / 2) + cy;
    const tx = link.target.y * Math.cos(link.target.x - Math.PI / 2) + cx;
    const ty = link.target.y * Math.sin(link.target.x - Math.PI / 2) + cy;

    return {
      source: { x: sx, y: sy },
      target: { x: tx, y: ty },
      sourceNode: link.source.data,
      targetNode: link.target.data,
    };
  });

  return { nodes, edges };
}
