import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@agents-ui/core/browser";
import { getProjectDisplayName } from "@agents-ui/core/browser";

const POPUP_DURATION_MS = 30_000; // 30 seconds

interface Props {
  sessions: Map<string, Session>;
}

export function WaitingAlert({ sessions }: Props) {
  const navigate = useNavigate();
  // Track which session IDs have been dismissed (auto or manual)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // Build waiting list
  const waitingSessions: Session[] = [];
  for (const s of sessions.values()) {
    if (s.waitingForInput) waitingSessions.push(s);
  }

  // Clear dismissed entries for sessions that are no longer waiting
  // (so they can re-trigger if they start waiting again later)
  useEffect(() => {
    const waitingIds = new Set(waitingSessions.map((s) => s.id));
    setDismissed((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (waitingIds.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [waitingSessions.length]);

  // Start auto-dismiss timers for new waiting sessions
  useEffect(() => {
    for (const s of waitingSessions) {
      if (!dismissed.has(s.id) && !timersRef.current.has(s.id)) {
        const timer = setTimeout(() => {
          dismiss(s.id);
        }, POPUP_DURATION_MS);
        timersRef.current.set(s.id, timer);
      }
    }
    return () => {
      // Cleanup on unmount
      for (const timer of timersRef.current.values()) clearTimeout(timer);
    };
  }, [waitingSessions, dismissed, dismiss]);

  // Only show popups for non-dismissed waiting sessions
  const visible = waitingSessions.filter((s) => !dismissed.has(s.id));

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {visible.map((s) => (
        <div key={s.id} className="relative">
          <button
            onClick={() => navigate(`/session/${s.id}`)}
            className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg px-4 py-3 pr-8 text-left backdrop-blur-sm shadow-lg shadow-yellow-500/10 animate-pulse cursor-pointer hover:bg-yellow-500/25 transition-colors w-full"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-yellow-400 text-lg">⚠</span>
              <span className="text-yellow-300 font-bold text-sm">
                Waiting for Input
              </span>
            </div>
            <div className="text-yellow-200/80 text-xs font-mono truncate">
              {getProjectDisplayName(s.projectDir)}
              <span className="text-yellow-200/40 ml-2">{s.id.slice(0, 8)}</span>
            </div>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(s.id); }}
            className="absolute top-2 right-2 text-yellow-500/50 hover:text-yellow-300 text-xs leading-none px-1"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
