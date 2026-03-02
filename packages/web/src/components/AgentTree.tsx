import type { AgentNode } from "@agents-ui/core/browser";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function AgentNodeView({ node, depth = 0 }: { node: AgentNode; depth?: number }) {
  const statusColor =
    node.status === "running"
      ? "text-green-400"
      : node.status === "error"
        ? "text-red-400"
        : "text-gray-500";

  const label = node.agentId === "root" ? "Main Agent" : node.agentType ?? node.agentId;

  return (
    <div className={depth > 0 ? "ml-6 border-l border-gray-800 pl-4" : ""}>
      <div className="flex items-center gap-2 py-1">
        <span
          className={`w-2 h-2 rounded-full ${
            node.status === "running"
              ? "bg-green-400 animate-pulse"
              : node.status === "error"
                ? "bg-red-400"
                : "bg-gray-600"
          }`}
        />
        <span className={`font-mono font-bold ${statusColor}`}>{label}</span>
        {node.model && (
          <span className="text-xs text-gray-600">({node.model})</span>
        )}
        {node.currentTool && (
          <span className="text-xs text-yellow-400 animate-pulse">
            → {node.currentTool}
          </span>
        )}
        {node.status === "completed" && node.durationMs != null && (
          <span className="text-xs text-gray-600">
            {formatDuration(node.durationMs)}
          </span>
        )}
        <span className="text-xs text-gray-700">
          {node.toolUseCount} tools
        </span>
      </div>

      {node.prompt && (
        <div className="text-xs text-gray-600 ml-4 mb-1 truncate max-w-lg">
          {node.prompt.slice(0, 120)}
        </div>
      )}

      {node.children.map((child) => (
        <AgentNodeView key={child.agentId} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function AgentTree({ root }: { root: AgentNode }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-bold text-cyan-400 mb-3">
        Agent Tree ({root.children.length} subagent
        {root.children.length !== 1 ? "s" : ""})
      </h3>
      <AgentNodeView node={root} />
    </div>
  );
}
