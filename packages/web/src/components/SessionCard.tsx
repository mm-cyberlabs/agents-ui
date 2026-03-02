import type { Session, SessionStatus } from "@agents-ui/core/browser";
import { getProjectDisplayName } from "@agents-ui/core/browser";

const STATUS_COLORS: Record<SessionStatus, string> = {
  active: "bg-green-500",
  idle: "bg-yellow-500",
  completed: "bg-gray-500",
};

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
      className="rounded-lg p-4 transition-colors text-left w-full"
      style={{
        backgroundColor: "var(--bg-card)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--border-color)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold truncate" style={{ color: "var(--accent)" }}>{project}</h3>
        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[session.status]}`} />
      </div>

      <div className="text-sm mb-3 space-y-1" style={{ color: "var(--text-secondary)" }}>
        <div className="flex justify-between">
          <span>Branch: {session.gitBranch || "-"}</span>
          <span>{timeAgo(session.lastActivityAt)}</span>
        </div>
        {session.model && <div>Model: {session.model}</div>}
      </div>

      <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
        <span>{formatTokens(totalTokens)} tokens</span>
        <span>{subagentCount} agents</span>
        <span>{session.messageCount} msgs</span>
      </div>

      {/* Context window bar */}
      <div className="mt-3">
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-color)" }}>
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
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Context: {Math.round(contextFill * 100)}%
        </div>
      </div>
    </button>
  );
}
