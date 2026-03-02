import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import type { AgentNode, ActivityEvent } from "@agents-ui/core/browser";
import {
  computeTreeLayout,
  CARD_W,
  CARD_H,
  type PositionedNode,
  type PositionedEdge,
} from "../lib/radial-layout.js";
import { AgentDetail } from "./AgentDetail.js";

const STATUS = {
  running: { bg: "#064e3b", border: "#22c55e", text: "#bbf7d0", dot: "#22c55e" },
  completed: { bg: "#252017", border: "#3D3425", text: "#C4A584", dot: "#8B7355" },
  error: { bg: "#450a0a", border: "#ef4444", text: "#fecaca", dot: "#ef4444" },
} as const;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type StatusFilter = "all" | "running" | "completed" | "error";

function TreeEdge({ edge }: { edge: PositionedEdge }) {
  const { source, target, targetNode } = edge;
  const isRunning = targetNode.status === "running";

  const midY = (source.y + CARD_H / 2 + target.y - CARD_H / 2) / 2;
  const d = `M ${source.x} ${source.y + CARD_H / 2}
             L ${source.x} ${midY}
             L ${target.x} ${midY}
             L ${target.x} ${target.y - CARD_H / 2}`;

  return (
    <g>
      <path d={d} stroke="#3D3425" strokeWidth={1.5} fill="none" />
      {isRunning && (
        <>
          <path d={d} stroke="#22c55e" strokeWidth={2} fill="none" opacity={0.3} />
          {[0, 0.33, 0.66].map((offset, i) => (
            <circle key={i} r={3} fill="#22c55e" opacity={0.8}>
              <animateMotion
                dur="1.5s"
                repeatCount="indefinite"
                begin={`${offset * 1.5}s`}
                path={d}
              />
            </circle>
          ))}
        </>
      )}
    </g>
  );
}

function TreeNode({
  positioned,
  index,
  onClick,
}: {
  positioned: PositionedNode;
  index: number;
  onClick: (node: AgentNode, x: number, y: number) => void;
}) {
  const { node, x, y } = positioned;
  const s = STATUS[node.status];
  const label = node.agentId === "root" ? "Main Agent" : node.agentType ?? node.agentId;
  const tokens = node.tokenUsage.totalInputTokens + node.tokenUsage.totalOutputTokens;
  const hw = CARD_W / 2;
  const hh = CARD_H / 2;
  const clipId = `card-clip-${index}`;
  const pad = 10;

  return (
    <g
      transform={`translate(${x - hw}, ${y - hh})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node, x, y);
      }}
      style={{ cursor: "pointer" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={CARD_W} height={CARD_H} rx={6} />
        </clipPath>
      </defs>

      {node.status === "running" && (
        <rect
          x={-3}
          y={-3}
          width={CARD_W + 6}
          height={CARD_H + 6}
          rx={8}
          fill="none"
          stroke={s.dot}
          strokeWidth={1.5}
          opacity={0.4}
        >
          <animate
            attributeName="opacity"
            values="0.4;0.1;0.4"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      {/* Hover highlight */}
      <rect
        width={CARD_W}
        height={CARD_H}
        rx={6}
        fill="white"
        opacity={0}
        className="agent-card-hover"
      />

      <rect
        width={CARD_W}
        height={CARD_H}
        rx={6}
        fill={s.bg}
        stroke={s.border}
        strokeWidth={1.5}
      />

      <g clipPath={`url(#${clipId})`}>
        <circle cx={pad + 2} cy={16} r={4} fill={s.dot} />

        <text x={pad + 12} y={19} fill={s.text} fontSize={12} fontWeight="bold">
          <title>{label}{node.model ? ` (${node.model})` : ""}</title>
          {label}
        </text>

        {node.model && (
          <text x={pad} y={35} fill="#8B7355" fontSize={10}>
            {node.model}
          </text>
        )}

        <text x={pad} y={52} fill="#C4A584" fontSize={10}>
          {formatTokens(tokens)} tok · {node.toolUseCount} tools
          {node.durationMs != null && node.status === "completed"
            ? ` · ${(node.durationMs / 1000).toFixed(1)}s`
            : ""}
        </text>

        {node.currentTool && (
          <text x={pad} y={69} fill="#eab308" fontSize={10}>
            → {node.currentTool}
          </text>
        )}
      </g>
    </g>
  );
}

interface AgentTreeProps {
  root: AgentNode;
  activity?: ActivityEvent[];
}

export function AgentTree({ root, activity = [] }: AgentTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const [transform, setTransform] = useState<{ scale: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const didDrag = useRef(false);

  const { nodes, edges, width: treeW, height: treeH } = useMemo(
    () => computeTreeLayout(root),
    [root],
  );

  const viewH = Math.max(500, Math.min(treeH + 60, 700));

  // Status counts for filter buttons
  const statusCounts = useMemo(() => {
    const counts = { running: 0, completed: 0, error: 0 };
    const walk = (n: AgentNode) => {
      counts[n.status]++;
      n.children.forEach(walk);
    };
    walk(root);
    return counts;
  }, [root]);

  // Filter nodes and edges by status
  const filteredNodes = useMemo(() => {
    if (statusFilter === "all") return nodes;
    const matchingIds = new Set<string>();
    const walk = (n: AgentNode) => {
      if (n.status === statusFilter) matchingIds.add(n.agentId);
      n.children.forEach(walk);
    };
    walk(root);
    return nodes.filter((n) => matchingIds.has(n.node.agentId));
  }, [nodes, root, statusFilter]);

  const filteredEdges = useMemo(() => {
    if (statusFilter === "all") return edges;
    const visibleIds = new Set(filteredNodes.map((n) => n.node.agentId));
    return edges.filter(
      (e) => visibleIds.has(e.sourceNode.agentId) && visibleIds.has(e.targetNode.agentId),
    );
  }, [edges, filteredNodes, statusFilter]);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerW(entry.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Auto-fit function
  const fitToView = useCallback(() => {
    if (containerW <= 0 || treeW <= 0) return;
    const scaleX = containerW / treeW;
    const scaleY = viewH / treeH;
    const fitScale = Math.min(scaleX, scaleY, 1);
    const offsetX = (containerW - treeW * fitScale) / 2;
    const offsetY = treeH * fitScale < viewH ? (viewH - treeH * fitScale) / 2 : 10;
    setTransform({ scale: fitScale, x: offsetX, y: offsetY });
  }, [containerW, treeW, treeH, viewH]);

  // Auto-fit on mount / resize / tree change
  useEffect(() => {
    fitToView();
  }, [fitToView]);

  const zoomIn = useCallback(() => {
    setTransform((t) => t ? { ...t, scale: Math.min(3, t.scale + 0.2) } : t);
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((t) => t ? { ...t, scale: Math.max(0.1, t.scale - 0.2) } : t);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((t) => {
      if (!t) return t;
      return { ...t, scale: Math.max(0.1, Math.min(3, t.scale - e.deltaY * 0.002)) };
    });
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!transform) return;
      setDragging(true);
      didDrag.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [transform],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      setTransform((t) => {
        if (!t) return t;
        return {
          ...t,
          x: dragStart.current.tx + dx,
          y: dragStart.current.ty + dy,
        };
      });
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => setDragging(false), []);

  const handleNodeClick = useCallback(
    (node: AgentNode, _nodeX: number, _nodeY: number) => {
      if (didDrag.current) return;
      setSelectedAgent(node);
    },
    [],
  );

  // Keep selected agent updated with latest data from tree
  const currentSelectedAgent = useMemo(() => {
    if (!selectedAgent) return null;
    const find = (n: AgentNode): AgentNode | null => {
      if (n.agentId === selectedAgent.agentId) return n;
      for (const c of n.children) {
        const found = find(c);
        if (found) return found;
      }
      return null;
    };
    return find(root);
  }, [root, selectedAgent]);

  const subCount = root.children.length;
  const t = transform ?? { scale: 1, x: 0, y: 0 };
  const totalAll = statusCounts.running + statusCounts.completed + statusCounts.error;

  const btnClass =
    "w-8 h-8 flex items-center justify-center rounded text-sm font-mono transition-colors";

  const filterButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: totalAll },
    { key: "running", label: "Running", count: statusCounts.running },
    { key: "completed", label: "Completed", count: statusCounts.completed },
    { key: "error", label: "Error", count: statusCounts.error },
  ];

  return (
    <div
      ref={containerRef}
      className="rounded-lg p-4 w-full relative"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold" style={{ color: "var(--accent)" }}>
          Agent Map ({subCount} subagent{subCount !== 1 ? "s" : ""})
        </h3>

        {/* Status filter buttons */}
        <div className="flex gap-1.5">
          {filterButtons.map((f) => {
            if (f.key !== "all" && f.count === 0) return null;
            const isActive = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className="px-2 py-0.5 text-xs rounded border transition-colors"
                style={{
                  backgroundColor: isActive ? "rgba(230, 125, 34, 0.2)" : "var(--bg-card)",
                  borderColor: isActive ? "rgba(230, 125, 34, 0.4)" : "var(--border-color)",
                  color: isActive ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {f.label} ({f.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-1 z-10">
        <button
          onClick={zoomIn}
          className={btnClass}
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          title="Zoom in"
        >+</button>
        <button
          onClick={zoomOut}
          className={btnClass}
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          title="Zoom out"
        >−</button>
        <button
          onClick={fitToView}
          className={btnClass}
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", fontSize: 10 }}
          title="Reset view"
        >⟳</button>
      </div>

      <div className="overflow-hidden rounded" style={{ height: viewH }}>
        <svg
          width="100%"
          height={viewH}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ cursor: dragging ? "grabbing" : "grab", userSelect: "none" }}
        >
          <g transform={`translate(${t.x}, ${t.y}) scale(${t.scale})`}>
            {filteredEdges.map((edge, i) => (
              <TreeEdge key={i} edge={edge} />
            ))}
            {filteredNodes.map((n, i) => (
              <TreeNode
                key={n.node.agentId}
                positioned={n}
                index={i}
                onClick={handleNodeClick}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* Agent detail modal */}
      {currentSelectedAgent && (
        <AgentDetail
          node={currentSelectedAgent}
          activity={activity}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}
