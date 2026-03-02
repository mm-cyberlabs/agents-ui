import React from "react";
import { Text } from "ink";
import type { SessionStatus } from "@agents-ui/core";

const STATUS_COLORS: Record<SessionStatus, string> = {
  active: "green",
  idle: "yellow",
  completed: "gray",
};

const STATUS_ICONS: Record<SessionStatus, string> = {
  active: "●",
  idle: "◐",
  completed: "○",
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <Text color={STATUS_COLORS[status]}>
      {STATUS_ICONS[status]} {status}
    </Text>
  );
}
