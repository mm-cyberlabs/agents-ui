import type { Session, SessionStatus } from "@agents-ui/core/browser";
import { getProjectDisplayName } from "@agents-ui/core/browser";

const STATUS_COLORS: Record<SessionStatus, string> = {
  active: "bg-green-500",
  idle: "bg-yellow-500",
  completed: "bg-gray-500",
};

const WAITING_BORDER = "border-yellow-500/60 ring-1 ring-yellow-500/30";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface Props {
  session: Session;
  onClick: () => void;
}

export function SessionCard({ session, onClick }: Props) {
  const project = getProjectDisplayName(session.projectDir);
  const totalTokens =
    session.tokenUsage.totalInputTokens + session.tokenUsage.totalOutputTokens;
  const contextFill =
    session.tokenUsage.estimatedContextUsed / session.tokenUsage.contextWindowSize;
  const subagentCount = session.agentTree.children.length;

  return (
    <button
      onClick={onClick}
      className={`bg-gray-900 border rounded-lg p-4 hover:border-cyan-600 transition-colors text-left w-full ${
        session.waitingForInput ? WAITING_BORDER : "border-gray-800"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-cyan-400 truncate">{project}</h3>
        <div className="flex items-center gap-2">
          {session.waitingForInput && (
            <span className="text-yellow-400 text-xs font-bold animate-pulse">
              ⚠ WAITING
            </span>
          )}
          <span className={`w-2 h-2 rounded-full ${session.waitingForInput ? "bg-yellow-400 animate-pulse" : STATUS_COLORS[session.status]}`} />
        </div>
      </div>

      <div className="text-sm text-gray-400 mb-3 space-y-1">
        <div className="flex justify-between">
          <span>Branch: {session.gitBranch || "-"}</span>
          <span>{timeAgo(session.lastActivityAt)}</span>
        </div>
        {session.model && <div>Model: {session.model}</div>}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{formatTokens(totalTokens)} tokens</span>
        <span>{subagentCount} agents</span>
        <span>{session.messageCount} msgs</span>
      </div>

      {/* Context window bar */}
      <div className="mt-3">
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              contextFill < 0.5
                ? "bg-green-500"
                : contextFill < 0.8
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${Math.min(100, contextFill * 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-600 mt-1">
          Context: {Math.round(contextFill * 100)}%
        </div>
      </div>
    </button>
  );
}
