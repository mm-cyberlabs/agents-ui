import type { TokenUsage } from "../types/jsonl.js";
import type { AggregatedTokenUsage } from "../types/session.js";
import { createEmptyTokenUsage } from "../types/agent-tree.js";

/**
 * Get the context window size for a given model identifier.
 */
export function getContextWindowSize(model?: string): number {
  if (!model) return 200_000;
  const m = model.toLowerCase();
  // Opus 4.6 with 1M context
  if (m.includes("opus-4-6") || m.includes("opus-4.6")) return 1_000_000;
  if (m.includes("opus") && m.includes("1m")) return 1_000_000;
  // Sonnet 4.6 with 1M context
  if (m.includes("sonnet-4-6") || m.includes("sonnet-4.6")) return 1_000_000;
  if (m.includes("sonnet") && m.includes("1m")) return 1_000_000;
  return 200_000;
}

/**
 * Accumulate a single API response's token usage into an aggregated total.
 */
export function accumulateTokens(
  agg: AggregatedTokenUsage,
  usage: TokenUsage,
  model?: string,
): void {
  agg.totalInputTokens += usage.input_tokens ?? 0;
  agg.totalOutputTokens += usage.output_tokens ?? 0;
  agg.totalCacheReadTokens += usage.cache_read_input_tokens ?? 0;
  agg.totalCacheWriteTokens += usage.cache_creation_input_tokens ?? 0;

  // Update estimated context usage (latest request's total input)
  agg.estimatedContextUsed =
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);

  // Update context window size based on model
  if (model) {
    agg.contextWindowSize = getContextWindowSize(model);

    if (!agg.byModel[model]) {
      agg.byModel[model] = { inputTokens: 0, outputTokens: 0 };
    }
    agg.byModel[model].inputTokens += usage.input_tokens ?? 0;
    agg.byModel[model].outputTokens += usage.output_tokens ?? 0;
  }
}

/**
 * Create a fresh aggregated token usage, optionally from a single usage.
 */
export function createTokenUsage(usage?: TokenUsage, model?: string): AggregatedTokenUsage {
  const agg = createEmptyTokenUsage();
  if (usage) accumulateTokens(agg, usage, model);
  return agg;
}

/**
 * Merge two aggregated token usages.
 */
export function mergeTokenUsage(
  a: AggregatedTokenUsage,
  b: AggregatedTokenUsage,
): AggregatedTokenUsage {
  const merged = createEmptyTokenUsage();
  merged.totalInputTokens = a.totalInputTokens + b.totalInputTokens;
  merged.totalOutputTokens = a.totalOutputTokens + b.totalOutputTokens;
  merged.totalCacheReadTokens = a.totalCacheReadTokens + b.totalCacheReadTokens;
  merged.totalCacheWriteTokens = a.totalCacheWriteTokens + b.totalCacheWriteTokens;
  merged.estimatedContextUsed = Math.max(a.estimatedContextUsed, b.estimatedContextUsed);
  merged.contextWindowSize = Math.max(a.contextWindowSize, b.contextWindowSize);
  merged.compactionCount = a.compactionCount + b.compactionCount;

  // Merge byModel
  const allModels = new Set([...Object.keys(a.byModel), ...Object.keys(b.byModel)]);
  for (const m of allModels) {
    merged.byModel[m] = {
      inputTokens: (a.byModel[m]?.inputTokens ?? 0) + (b.byModel[m]?.inputTokens ?? 0),
      outputTokens: (a.byModel[m]?.outputTokens ?? 0) + (b.byModel[m]?.outputTokens ?? 0),
    };
  }

  return merged;
}
