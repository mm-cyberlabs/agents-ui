import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Session, ActivityEvent } from "@agents-ui/core/browser";
import { getProjectDisplayName } from "@agents-ui/core/browser";
import { AgentTree } from "../components/AgentTree.js";
import { ActivityStream } from "../components/ActivityStream.js";
import { TokenChart } from "../components/TokenChart.js";
import { ContextHealth } from "../components/ContextHealth.js";

interface Props {
  sessions: Map<string, Session>;
  activity: ActivityEvent[];
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  idle: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-400",
  idle: "bg-yellow-400",
};

function truncateId(id: string, maxLen = 8): string {
  return id.length > maxLen ? id.slice(0, maxLen) : id;
}

export function SessionDetail({ sessions, activity }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = id ? sessions.get(id) : undefined;

  const switchableSessions = useMemo(() => {
    const result: Session[] = [];
    for (const s of sessions.values()) {
      if (s.status === "active" || s.status === "idle") {
        result.push(s);
      }
    }
    result.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );
    return result;
  }, [sessions]);

  const sessionActivity = useMemo(
    () => (session ? activity.filter((e) => e.sessionId === session.id) : []),
    [activity, session],
  );

  if (!session) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-20 text-gray-600">
          Session not found
        </div>
      </div>
    );
  }

  const project = getProjectDisplayName(session.projectDir);

  return (
    <div className="p-6 w-full">
      {/* Session Switcher Bar */}
      {switchableSessions.length > 1 && (
        <div className="mb-4 -mx-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
            {switchableSessions.map((s) => {
              const isSelected = s.id === id;
              const projName = getProjectDisplayName(s.projectDir);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (!isSelected) navigate(`/session/${s.id}`);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap shrink-0 border transition-colors ${
                    isSelected
                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/50"
                      : "bg-gray-800/60 text-gray-400 border-gray-700/50 hover:bg-gray-800 hover:text-gray-300 hover:border-gray-600"
                  }`}
                  title={`${projName} — ${s.id}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s.status] ?? "bg-gray-500"}`}
                  />
                  <span className="truncate max-w-[120px]">{projName}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-500">{truncateId(s.id)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">{project}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>Branch: {session.gitBranch || "-"}</span>
            <span>Version: {session.version || "-"}</span>
            <span>{session.messageCount} messages</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {session.waitingForInput && (
            <span className="px-2 py-1 rounded text-xs border bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse font-bold">
              ⚠ Waiting for Input
            </span>
          )}
          <span
            className={`px-2 py-1 rounded text-xs border ${STATUS_STYLES[session.status] ?? STATUS_STYLES.completed}`}
          >
            {session.status}
          </span>
          <ContextHealth usage={session.tokenUsage} />
        </div>
      </div>

      {/* Agent map — full width */}
      <AgentTree root={session.agentTree} activity={sessionActivity} />

      {/* Token chart + Activity stream below */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-1">
          <TokenChart usage={session.tokenUsage} />
        </div>
        <div className="lg:col-span-2">
          <ActivityStream events={sessionActivity} />
        </div>
      </div>
    </div>
  );
}
