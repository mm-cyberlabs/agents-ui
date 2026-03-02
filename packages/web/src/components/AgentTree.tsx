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
  completed: { bg: "#1f2937", border: "#4b5563", text: "#d1d5db", dot: "#6b7280" },
  error: { bg: "#450a0a", border: "#ef4444", text: "#fecaca", dot: "#ef4444" },
} as const;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

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
      <path d={d} stroke="#374151" strokeWidth={1.5} fill="none" />
      {isRunning && (
        <path
          d={d}
          stroke="#22c55e"
          strokeWidth={1.5}
          fill="none"
          strokeDasharray="4 8"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="12"
            to="0"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </path>
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
  onClick: (node: AgentNode) => void;
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
        onClick(node);
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

      {/* Hover highlight — invisible rect that becomes visible on hover via CSS */}
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
          <text x={pad} y={35} fill="#6b7280" fontSize={10}>
            {node.model}
          </text>
        )}

        <text x={pad} y={52} fill="#9ca3af" fontSize={10}>
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
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const didDrag = useRef(false);

  const { nodes, edges, width: treeW, height: treeH } = useMemo(
    () => computeTreeLayout(root),
    [root],
  );

  const viewH = Math.max(500, Math.min(treeH + 60, 700));

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

  const handleNodeClick = useCallback((node: AgentNode) => {
    // Only open modal if the user didn't drag
    if (!didDrag.current) {
      // Find the latest version of this node in the current tree
      setSelectedAgent(node);
    }
  }, []);

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

  const btnClass =
    "w-8 h-8 flex items-center justify-center rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white text-sm font-mono transition-colors";

  return (
    <div ref={containerRef} className="bg-gray-900 rounded-lg p-4 border border-gray-800 w-full relative">
      <h3 className="text-sm font-bold text-cyan-400 mb-2">
        Agent Map ({subCount} subagent{subCount !== 1 ? "s" : ""})
      </h3>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-1 z-10">
        <button onClick={zoomIn} className={btnClass} title="Zoom in">+</button>
        <button onClick={zoomOut} className={btnClass} title="Zoom out">−</button>
        <button onClick={fitToView} className={btnClass} title="Reset view" style={{ fontSize: 10 }}>
          ⟳
        </button>
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
            {edges.map((edge, i) => (
              <TreeEdge key={i} edge={edge} />
            ))}
            {nodes.map((n, i) => (
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
