import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import type { AgentNode } from "@agents-ui/core/browser";
import { computeRadialLayout, type PositionedNode, type PositionedEdge } from "../lib/radial-layout.js";

const NODE_RADIUS = 36;

const STATUS_COLORS = {
  running: { fill: "#22c55e", stroke: "#16a34a", text: "#bbf7d0" },
  completed: { fill: "#6b7280", stroke: "#4b5563", text: "#d1d5db" },
  error: { fill: "#ef4444", stroke: "#dc2626", text: "#fecaca" },
} as const;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function RadialEdge({ edge }: { edge: PositionedEdge }) {
  const { source, target, targetNode } = edge;
  const isRunning = targetNode.status === "running";

  // Quadratic bezier through midpoint pushed slightly outward from center
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  const d = `M ${source.x} ${source.y} Q ${mx} ${my} ${target.x} ${target.y}`;

  return (
    <g>
      <path d={d} stroke="#374151" strokeWidth={2} fill="none" />
      {isRunning && (
        <path
          d={d}
          stroke="#22c55e"
          strokeWidth={2}
          fill="none"
          strokeDasharray="6 12"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="18"
            to="0"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      )}
    </g>
  );
}

function RadialNode({ positioned }: { positioned: PositionedNode }) {
  const { node, x, y } = positioned;
  const colors = STATUS_COLORS[node.status];
  const label = node.agentId === "root" ? "Main Agent" : node.agentType ?? node.agentId;
  const tokens = node.tokenUsage.totalInputTokens + node.tokenUsage.totalOutputTokens;
  const truncatedLabel = label.length > 14 ? label.slice(0, 12) + "…" : label;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pulse ring for running agents */}
      {node.status === "running" && (
        <circle
          r={NODE_RADIUS + 4}
          fill="none"
          stroke={colors.fill}
          strokeWidth={2}
          opacity={0.5}
          className="radial-pulse"
        />
      )}

      {/* Node circle */}
      <circle r={NODE_RADIUS} fill="#111827" stroke={colors.stroke} strokeWidth={2.5} />

      {/* Status dot */}
      <circle cx={NODE_RADIUS - 10} cy={-NODE_RADIUS + 10} r={5} fill={colors.fill} />

      {/* Label */}
      <text y={-10} textAnchor="middle" fill={colors.text} fontSize={11} fontWeight="bold">
        <title>{label}</title>
        {truncatedLabel}
      </text>

      {/* Model */}
      {node.model && (
        <text y={4} textAnchor="middle" fill="#6b7280" fontSize={9}>
          {node.model.length > 16 ? node.model.slice(0, 14) + "…" : node.model}
        </text>
      )}

      {/* Current tool or token count */}
      <text
        y={18}
        textAnchor="middle"
        fill={node.currentTool ? "#eab308" : "#4b5563"}
        fontSize={9}
      >
        {node.currentTool ? `→ ${node.currentTool}` : `${formatTokens(tokens)} tok`}
      </text>

      {/* Tool count */}
      <text y={29} textAnchor="middle" fill="#374151" fontSize={8}>
        {node.toolUseCount} tools
      </text>
    </g>
  );
}

export function AgentTree({ root }: { root: AgentNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const h = Math.max(400, entry.contentRect.height);
      setDimensions({ width: w, height: h });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const { nodes, edges } = useMemo(
    () => computeRadialLayout(root, dimensions.width, dimensions.height),
    [root, dimensions],
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.3, Math.min(3, t.scale - e.deltaY * 0.002)),
    }));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [transform.x, transform.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setTransform((t) => ({
        ...t,
        x: dragStart.current.tx + dx,
        y: dragStart.current.ty + dy,
      }));
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const subCount = root.children.length;

  return (
    <div ref={containerRef} className="bg-gray-900 rounded-lg p-4 border border-gray-800 min-h-[450px]">
      <h3 className="text-sm font-bold text-cyan-400 mb-2">
        Agent Map ({subCount} subagent{subCount !== 1 ? "s" : ""})
      </h3>
      <svg
        width={dimensions.width - 32}
        height={dimensions.height - 60}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          cursor: dragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
      >
        <g
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
        >
          {edges.map((edge, i) => (
            <RadialEdge key={i} edge={edge} />
          ))}
          {nodes.map((n) => (
            <RadialNode key={n.node.agentId} positioned={n} />
          ))}
        </g>
      </svg>
    </div>
  );
}
