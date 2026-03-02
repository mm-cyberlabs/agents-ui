import type { AggregatedTokenUsage } from "@agents-ui/core/browser";

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function TokenChart({ usage }: { usage: AggregatedTokenUsage }) {
  const contextFill = usage.estimatedContextUsed / usage.contextWindowSize;

  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--accent)" }}>Token Usage</h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span style={{ color: "var(--text-muted)" }}>Input</span>
          <div className="font-bold" style={{ color: "var(--text-primary)" }}>{formatNum(usage.totalInputTokens)}</div>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Output</span>
          <div className="font-bold" style={{ color: "var(--text-primary)" }}>{formatNum(usage.totalOutputTokens)}</div>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Cache Read</span>
          <div className="font-bold text-green-400">
            {formatNum(usage.totalCacheReadTokens)}
          </div>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Cache Write</span>
          <div className="font-bold" style={{ color: "var(--text-primary)" }}>{formatNum(usage.totalCacheWriteTokens)}</div>
        </div>
      </div>

      {/* Context gauge */}
      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
          <span>Context Window</span>
          <span>{Math.round(contextFill * 100)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-color)" }}>
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
          {formatNum(usage.estimatedContextUsed)} / {formatNum(usage.contextWindowSize)}
          {usage.compactionCount > 0 && (
            <span className="ml-2" style={{ color: "var(--text-secondary)" }}>
              ({usage.compactionCount} compaction{usage.compactionCount !== 1 ? "s" : ""})
            </span>
          )}
        </div>
      </div>

      {/* By model */}
      {Object.keys(usage.byModel).length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>By Model</h4>
          {Object.entries(usage.byModel).map(([model, u]) => (
            <div key={model} className="flex justify-between text-xs py-0.5">
              <span className="truncate mr-2" style={{ color: "var(--text-secondary)" }}>{model}</span>
              <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
                {formatNum(u.inputTokens)} in / {formatNum(u.outputTokens)} out
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
