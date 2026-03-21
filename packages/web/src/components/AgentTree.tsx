import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import type { AgentNode, ActivityEvent } from "@agents-ui/core/browser";
import { pruneStaleAgents } from "@agents-ui/core/browser";
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

type StatusFilter = "all" | "running" | "completed" | "error";

function TreeEdge({ edge }: { edge: PositionedEdge }) {
  const { source, target, targetNode } = edge;
  const isRunning = targetNode.status === "running";

  // Top-down: parent-bottom → child-top
  const midY = (source.y + CARD_H / 2 + target.y - CARD_H / 2) / 2;
  const d = `M ${source.x} ${source.y + CARD_H / 2}
       L ${source.x} ${midY}
       L ${target.x} ${midY}
       L ${target.x} ${target.y - CARD_H / 2}`;

  return (
    <g>
      <path d={d} stroke="#374151" strokeWidth={1.5} fill="none" />
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
  const label = node.agentId === "root" ? (node.name ?? "Main Agent") : node.name ?? node.agentType ?? node.agentId;
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
      filter="url(#card-shadow)"
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
  disablePrune?: boolean;
}

export function AgentTree({ root: rawRoot, activity = [], disablePrune = false }: AgentTreeProps) {
  const root = useMemo(() => disablePrune ? rawRoot : pruneStaleAgents(rawRoot), [rawRoot, disablePrune]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { nodes, edges, width: treeW, height: treeH } = useMemo(
    () => computeTreeLayout(root, containerW > 0 ? containerW : undefined),
    [root, containerW],
  );

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

  const handleNodeClick = useCallback(
    (node: AgentNode, _nodeX: number, _nodeY: number) => {
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
  const totalAll = statusCounts.running + statusCounts.completed + statusCounts.error;

  const filterButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: totalAll },
    { key: "running", label: "Running", count: statusCounts.running },
    { key: "completed", label: "Completed", count: statusCounts.completed },
    { key: "error", label: "Error", count: statusCounts.error },
  ];

  return (
    <div ref={containerRef} className="bg-gray-900 rounded-lg p-4 border border-gray-800 w-full relative">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-cyan-400">
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
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  isActive
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                    : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
                }`}
              >
                {f.label} ({f.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable SVG — cards are always full size, no scaling */}
      <div className="overflow-auto rounded" style={{ maxHeight: 700 }}>
        <svg
          width={treeW}
          height={treeH}
          style={{ minWidth: "100%" }}
        >
          <defs>
            <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
            </filter>
          </defs>
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
