import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@agents-ui/core/browser";
import { getProjectDisplayName } from "@agents-ui/core/browser";

interface Props {
  sessions: Map<string, Session>;
}

export function WaitingAlert({ sessions }: Props) {
  const navigate = useNavigate();

  const waitingSessions = useMemo(() => {
    const result: Session[] = [];
    for (const s of sessions.values()) {
      if (s.waitingForInput) result.push(s);
    }
    return result;
  }, [sessions]);

  if (waitingSessions.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {waitingSessions.map((s) => (
        <button
          key={s.id}
          onClick={() => navigate(`/session/${s.id}`)}
          className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg px-4 py-3 text-left backdrop-blur-sm shadow-lg shadow-yellow-500/10 animate-pulse cursor-pointer hover:bg-yellow-500/25 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-400 text-lg">⚠</span>
            <span className="text-yellow-300 font-bold text-sm">
              Waiting for Input
            </span>
          </div>
          <div className="text-yellow-200/80 text-xs font-mono truncate">
            {getProjectDisplayName(s.projectDir)}
          </div>
          <div className="text-yellow-200/50 text-xs mt-1">
            Click to view session
          </div>
        </button>
      ))}
    </div>
  );
}
