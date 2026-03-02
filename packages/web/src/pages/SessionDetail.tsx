import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
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

export function SessionDetail({ sessions, activity }: Props) {
  const { id } = useParams<{ id: string }>();
  const session = id ? sessions.get(id) : undefined;

  const sessionActivity = useMemo(
    () => (session ? activity.filter((e) => e.sessionId === session.id) : []),
    [activity, session],
  );

  if (!session) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Link to="/" className="text-cyan-400 hover:underline text-sm">
          ← Back to Dashboard
        </Link>
        <div className="text-center py-20 text-gray-600">
          Session not found
        </div>
      </div>
    );
  }

  const project = getProjectDisplayName(session.projectDir);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="text-cyan-400 hover:underline text-sm">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-white mt-1">{project}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>Branch: {session.gitBranch || "-"}</span>
            <span>Version: {session.version || "-"}</span>
            <span>{session.messageCount} messages</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`px-2 py-1 rounded text-xs border ${STATUS_STYLES[session.status] ?? STATUS_STYLES.completed}`}
          >
            {session.status}
          </span>
          <ContextHealth usage={session.tokenUsage} />
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Agent tree */}
        <div className="lg:col-span-1">
          <AgentTree root={session.agentTree} />
          <div className="mt-4">
            <TokenChart usage={session.tokenUsage} />
          </div>
        </div>

        {/* Right: Activity stream */}
        <div className="lg:col-span-2">
          <ActivityStream events={sessionActivity} />
        </div>
      </div>
    </div>
  );
}
