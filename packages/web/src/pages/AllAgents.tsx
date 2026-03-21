import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Session, AgentNode, ActivityEvent } from "@agents-ui/core/browser";
import { getProjectDisplayName, pruneStaleAgents } from "@agents-ui/core/browser";
import { AgentTree } from "../components/AgentTree.js";

interface Props {
  sessions: Map<string, Session>;
  activity: ActivityEvent[];
}

/**
 * Build a virtual super-root whose children are each session's root agent,
 * relabeled with the project name so you can tell them apart on the map.
 */
function buildUnifiedTree(sessions: Session[]): AgentNode {
  const children: AgentNode[] = sessions.map((s) => {
    const pruned = pruneStaleAgents(s.agentTree);
    // Re-label the session root with the project name
    return {
      ...pruned,
      agentId: `session-root-${s.id}`,
      name: getProjectDisplayName(s.projectDir),
      agentType: s.model ?? "session",
    };
  });

  return {
    agentId: "root",
    sessionId: "all",
    parentAgentId: null,
    name: "All Sessions",
    status: children.some((c) => c.status === "running") ? "running" : "completed",
    startedAt: new Date().toISOString(),
    tokenUsage: {
      totalInputTokens: children.reduce((s, c) => s + c.tokenUsage.totalInputTokens, 0),
      totalOutputTokens: children.reduce((s, c) => s + c.tokenUsage.totalOutputTokens, 0),
      totalCacheReadTokens: children.reduce((s, c) => s + c.tokenUsage.totalCacheReadTokens, 0),
      totalCacheWriteTokens: children.reduce((s, c) => s + c.tokenUsage.totalCacheWriteTokens, 0),
      byModel: {},
      estimatedContextUsed: 0,
      contextWindowSize: 0,
      compactionCount: 0,
    },
    toolUseCount: children.reduce((s, c) => s + c.toolUseCount, 0),
    children,
  };
}

export function AllAgents({ sessions, activity }: Props) {
  const activeSessions = useMemo(() => {
    const result: Session[] = [];
    for (const s of sessions.values()) {
      if (s.status !== "completed") result.push(s);
    }
    result.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );
    return result;
  }, [sessions]);

  const unifiedRoot = useMemo(
    () => buildUnifiedTree(activeSessions),
    [activeSessions],
  );

  const totalAgents = useMemo(() => {
    const count = (n: AgentNode): number =>
      1 + n.children.reduce((s, c) => s + count(c), 0);
    return count(unifiedRoot) - 1; // exclude virtual root
  }, [unifiedRoot]);

  const runningCount = useMemo(() => {
    const count = (n: AgentNode): number =>
      (n.status === "running" ? 1 : 0) +
      n.children.reduce((s, c) => s + count(c), 0);
    return count(unifiedRoot);
  }, [unifiedRoot]);

  return (
    <div className="p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="text-cyan-400 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold text-white mt-1">All Agents</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>{activeSessions.length} active session{activeSessions.length !== 1 ? "s" : ""}</span>
            <span>{totalAgents} agent{totalAgents !== 1 ? "s" : ""}</span>
            {runningCount > 0 && (
              <span className="text-green-400">{runningCount} running</span>
            )}
          </div>
        </div>
      </div>

      {activeSessions.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-lg mb-2">No active sessions</p>
          <p className="text-sm">Start a Claude Code session to see agents here.</p>
        </div>
      ) : (
        <AgentTree root={unifiedRoot} activity={activity} />
      )}
    </div>
  );
}
