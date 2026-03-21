import React from "react";
import { Box, Text } from "ink";
import type { Session } from "@agents-ui/core";
import { getProjectDisplayName } from "@agents-ui/core";

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
}

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

export function SessionList({ sessions, selectedIndex }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>No sessions found. Start a Claude Code session to see it here.</Text>
        <Text dimColor>Watching ~/.claude/projects/ for JSONL transcripts...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box gap={1} paddingX={1}>
        <Text bold color="gray">
          {"  "}
          {"Project".padEnd(22)}
          {"Branch".padEnd(16)}
          {"Status".padEnd(12)}
          {"Model".padEnd(18)}
          {"Tokens".padEnd(12)}
          {"Last Active"}
        </Text>
      </Box>

      {/* Rows */}
      {sessions.map((session, i) => {
        const isSelected = i === selectedIndex;
        const project = getProjectDisplayName(session.projectDir);
        const totalTokens =
          session.tokenUsage.totalInputTokens + session.tokenUsage.totalOutputTokens;

        return (
          <Box key={session.id} gap={1} paddingX={1}>
            <Text color={isSelected ? "#E67D22" : undefined} bold={isSelected}>
              {isSelected ? "▸ " : "  "}
              {project.padEnd(22).slice(0, 22)}
              {(session.gitBranch || "-").padEnd(16).slice(0, 16)}
            </Text>
            {session.waitingForInput ? (
              <Text color="yellow" bold>⚠ waiting </Text>
            ) : (
              <Text color={session.status === "active" ? "green" : session.status === "idle" ? "yellow" : "gray"}>
                {session.status === "active" ? "●" : session.status === "idle" ? "◐" : "○"} {session.status.padEnd(9)}
              </Text>
            )}
            <Text>
              {"  "}
              {(session.model ?? "-").padEnd(18).slice(0, 18)}
              {formatTokens(totalTokens).padEnd(12)}
              {timeAgo(session.lastActivityAt)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
