import React from "react";
import { Box, Text } from "ink";
import type { Session } from "@agents-ui/core";
import { ProgressBar } from "../components/progress-bar.js";

interface TokenDashboardProps {
  session: Session | null;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function TokenDashboard({ session }: TokenDashboardProps) {
  if (!session) {
    return (
      <Box padding={1}>
        <Text dimColor>Select a session to view token usage.</Text>
      </Box>
    );
  }

  const { tokenUsage } = session;
  const totalInput = tokenUsage.totalInputTokens + tokenUsage.totalCacheReadTokens;
  const totalOutput = tokenUsage.totalOutputTokens;
  const contextFill = tokenUsage.estimatedContextUsed / tokenUsage.contextWindowSize;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="#E67D22">Token Usage</Text>
      <Box flexDirection="column" marginTop={1} gap={0}>
        <Text>Input tokens:    <Text bold>{formatNum(totalInput)}</Text></Text>
        <Text>Output tokens:   <Text bold>{formatNum(totalOutput)}</Text></Text>
        <Text>Cache read:      <Text bold color="green">{formatNum(tokenUsage.totalCacheReadTokens)}</Text></Text>
        <Text>Cache write:     <Text bold>{formatNum(tokenUsage.totalCacheWriteTokens)}</Text></Text>
        <Text>Compactions:     <Text bold>{tokenUsage.compactionCount}</Text></Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color="#E67D22">Context Window</Text>
        <ProgressBar value={contextFill} label="Fill" width={40} />
        <Text dimColor>
          {formatNum(tokenUsage.estimatedContextUsed)} / {formatNum(tokenUsage.contextWindowSize)} tokens
        </Text>
      </Box>

      {Object.keys(tokenUsage.byModel).length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="#E67D22">By Model</Text>
          {Object.entries(tokenUsage.byModel).map(([model, usage]) => (
            <Text key={model}>
              <Text dimColor>{model.padEnd(28)}</Text>
              <Text>In: {formatNum(usage.inputTokens).padEnd(8)} Out: {formatNum(usage.outputTokens)}</Text>
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
