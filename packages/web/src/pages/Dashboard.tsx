import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@agents-ui/core/browser";
import { SessionCard } from "../components/SessionCard.js";

interface Props {
  sessions: Map<string, Session>;
  connected: boolean;
}

export function Dashboard({ sessions, connected }: Props) {
  const sorted = useMemo(
    () =>
      Array.from(sessions.values()).sort(
        (a, b) =>
          new Date(b.lastActivityAt).getTime() -
          new Date(a.lastActivityAt).getTime(),
      ),
    [sessions],
  );

  const navigate = useNavigate();

  const active = sorted.filter((s) => s.status === "active");
  const idle = sorted.filter((s) => s.status === "idle");
  const completed = sorted.filter((s) => s.status === "completed");

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
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
          />
          <span className="text-sm text-gray-500">
            {connected ? "Connected" : "Disconnected"}
          </span>
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
          {active.length > 0 && (
            <Section title="Active" count={active.length}>
              {active.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onClick={() => navigate(`/session/${s.id}`)}
                />
              ))}
            </Section>
          )}
          {idle.length > 0 && (
            <Section title="Idle" count={idle.length}>
              {idle.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onClick={() => navigate(`/session/${s.id}`)}
                />
              ))}
            </Section>
          )}
          {completed.length > 0 && (
            <Section title="Completed" count={completed.length}>
              {completed.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onClick={() => navigate(`/session/${s.id}`)}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
        {title} ({count})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}
