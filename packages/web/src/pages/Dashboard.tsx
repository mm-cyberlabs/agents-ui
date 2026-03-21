import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { Session } from "@agents-ui/core/browser";
import { getProjectDisplayName } from "@agents-ui/core/browser";
import { SessionCard } from "../components/SessionCard.js";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function countAgents(session: Session): number {
  const walk = (node: Session["agentTree"]): number =>
    1 + node.children.reduce((sum, c) => sum + walk(c), 0);
  return walk(session.agentTree);
}

interface Props {
  sessions: Map<string, Session>;
  connected: boolean;
  onRefresh: () => Promise<void>;
}

export function Dashboard({ sessions, connected, onRefresh }: Props) {
  const sorted = useMemo(
    () =>
      Array.from(sessions.values())
        .filter((s) => s.status !== "completed")
        .sort(
          (a, b) =>
            new Date(b.lastActivityAt).getTime() -
            new Date(a.lastActivityAt).getTime(),
        ),
    [sessions],
  );

  const navigate = useNavigate();

  const projectGroups = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sorted) {
      let group = map.get(s.projectDir);
      if (!group) {
        group = [];
        map.set(s.projectDir, group);
      }
      group.push(s);
    }
    // Sort groups by most recent activity
    return Array.from(map.entries())
      .map(([projectDir, groupSessions]) => ({ projectDir, sessions: groupSessions }))
      .sort(
        (a, b) =>
          new Date(b.sessions[0].lastActivityAt).getTime() -
          new Date(a.sessions[0].lastActivityAt).getTime(),
      );
  }, [sorted]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-cyan-400">agents-ui</h1>
          <p className="text-sm text-gray-500">
            Real-time Claude Code agent monitor
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onRefresh}
            className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
            title="Re-scan sessions and refresh statuses"
          >
            ↻ Refresh
          </button>
          <Link
            to="/agents"
            className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
          >
            All Agents
          </Link>
          <Link
            to="/config"
            className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
          >
            Config
          </Link>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
            />
            <span className="text-sm text-gray-500">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-lg mb-2">No sessions found</p>
          <p className="text-sm">
            Start a Claude Code session to see it here.
            <br />
            Watching ~/.claude/projects/ for JSONL transcripts...
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {projectGroups.map((group) => {
            const totalTokens = group.sessions.reduce(
              (sum, s) =>
                sum + s.tokenUsage.totalInputTokens + s.tokenUsage.totalOutputTokens,
              0,
            );
            const totalAgents = group.sessions.reduce(
              (sum, s) => sum + countAgents(s),
              0,
            );
            const activeCount = group.sessions.filter(
              (s) => s.status === "active",
            ).length;

            return (
              <div key={group.projectDir}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
                    {getProjectDisplayName(group.projectDir)}
                    <span className="text-gray-500 ml-2">
                      ({group.sessions.length} session
                      {group.sessions.length !== 1 ? "s" : ""})
                    </span>
                  </h2>
                  <div className="flex gap-4 text-xs text-gray-500">
                    {activeCount > 0 && (
                      <span className="text-green-400">
                        {activeCount} active
                      </span>
                    )}
                    <span>{formatTokens(totalTokens)} tokens</span>
                    <span>{totalAgents} agent{totalAgents !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.sessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onClick={() => navigate(`/session/${s.id}`)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
