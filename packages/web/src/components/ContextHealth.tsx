import type { AggregatedTokenUsage } from "@agents-ui/core/browser";

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ContextHealth({ usage }: { usage: AggregatedTokenUsage }) {
  const fill = usage.estimatedContextUsed / usage.contextWindowSize;
  const percent = Math.round(fill * 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - Math.min(1, fill));

  const color =
    fill < 0.5 ? "#22c55e" : fill < 0.8 ? "#eab308" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#3D3425"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          transform="rotate(-90 50 50)"
        />
        {/* Percentage text */}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize="18"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {percent}%
        </text>
      </svg>
      <div className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        {formatNum(usage.estimatedContextUsed)} / {formatNum(usage.contextWindowSize)}
      </div>
    </div>
  );
}
