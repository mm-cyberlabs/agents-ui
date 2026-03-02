import React from "react";
import { Text } from "ink";

interface ProgressBarProps {
  value: number; // 0-1
  width?: number;
  label?: string;
}

export function ProgressBar({ value, width = 30, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  const percent = Math.round(clamped * 100);

  const color = percent < 50 ? "green" : percent < 80 ? "yellow" : "red";

  return (
    <Text>
      {label && <Text dimColor>{label} </Text>}
      <Text color={color}>{"█".repeat(filled)}</Text>
      <Text dimColor>{"░".repeat(empty)}</Text>
      <Text> {percent}%</Text>
    </Text>
  );
}
