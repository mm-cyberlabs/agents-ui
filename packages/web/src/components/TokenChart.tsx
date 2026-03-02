import type { AggregatedTokenUsage } from "@agents-ui/core/browser";

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function TokenChart({ usage }: { usage: AggregatedTokenUsage }) {
  const contextFill = usage.estimatedContextUsed / usage.contextWindowSize;

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-bold text-cyan-400 mb-3">Token Usage</h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Input</span>
          <div className="font-bold">{formatNum(usage.totalInputTokens)}</div>
        </div>
        <div>
          <span className="text-gray-500">Output</span>
          <div className="font-bold">{formatNum(usage.totalOutputTokens)}</div>
        </div>
        <div>
          <span className="text-gray-500">Cache Read</span>
          <div className="font-bold text-green-400">
            {formatNum(usage.totalCacheReadTokens)}
          </div>
        </div>
        <div>
          <span className="text-gray-500">Cache Write</span>
          <div className="font-bold">{formatNum(usage.totalCacheWriteTokens)}</div>
        </div>
      </div>

      {/* Context gauge */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Context Window</span>
          <span>{Math.round(contextFill * 100)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
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
          {formatNum(usage.estimatedContextUsed)} / {formatNum(usage.contextWindowSize)}
          {usage.compactionCount > 0 && (
            <span className="ml-2 text-purple-400">
              ({usage.compactionCount} compaction{usage.compactionCount !== 1 ? "s" : ""})
            </span>
          )}
        </div>
      </div>

      {/* By model */}
      {Object.keys(usage.byModel).length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs text-gray-500 mb-2">By Model</h4>
          {Object.entries(usage.byModel).map(([model, u]) => (
            <div key={model} className="flex justify-between text-xs py-0.5">
              <span className="text-gray-400 truncate mr-2">{model}</span>
              <span className="text-gray-500 shrink-0">
                {formatNum(u.inputTokens)} in / {formatNum(u.outputTokens)} out
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
