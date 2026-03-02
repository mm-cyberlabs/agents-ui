import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { Session, ActivityEvent } from "@agents-ui/core";
import { useWs } from "./hooks/use-ws.js";
import { TabBar } from "./components/tab-bar.js";
import { SessionList } from "./views/session-list.js";
import { AgentTreeView, getAgentCount } from "./views/agent-tree-view.js";
import { ActivityFeed } from "./views/activity-feed.js";
import { TokenDashboard } from "./views/token-dashboard.js";

const TABS = ["Sessions", "Agents", "Activity", "Tokens"];

interface AppProps {
  serverUrl: string;
}

export function App({ serverUrl }: AppProps) {
  const { sessions, activity, connected } = useWs(serverUrl);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSession, setSelectedSession] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState(0);

  const sessionList = useMemo(
    () => Array.from(sessions.values())
      .filter((s) => s.status !== "completed")
      .sort((a, b) =>
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
      ),
    [sessions],
  );

  const currentSession: Session | null = sessionList[selectedSession] ?? null;

  // Filter activity for selected session
  const sessionActivity: ActivityEvent[] = useMemo(() => {
    if (!currentSession) return activity;
    return activity.filter((e) => e.sessionId === currentSession.id);
  }, [activity, currentSession]);

  // Reset agent selection when session changes
  const currentSessionId = currentSession?.id;
  const [lastSessionId, setLastSessionId] = useState<string | undefined>();
  if (currentSessionId !== lastSessionId) {
    setLastSessionId(currentSessionId);
    setSelectedAgent(0);
  }

  const { exit } = useApp();

  useInput((input, key) => {
    // Quit
    if (input === "q") {
      exit();
      return;
    }

    // Tab switching with number keys
    const num = parseInt(input, 10);
    if (num >= 1 && num <= TABS.length) {
      setActiveTab(num - 1);
      return;
    }

    // Up/down behavior depends on active tab
    if (key.upArrow) {
      if (activeTab === 0) {
        setSelectedSession((prev) => Math.max(0, prev - 1));
      } else if (activeTab === 1) {
        setSelectedAgent((prev) => Math.max(0, prev - 1));
      }
    }
    if (key.downArrow) {
      if (activeTab === 0) {
        setSelectedSession((prev) => Math.min(sessionList.length - 1, prev + 1));
      } else if (activeTab === 1) {
        const max = getAgentCount(currentSession) - 1;
        setSelectedAgent((prev) => Math.min(max, prev + 1));
      }
    }

    // Tab with left/right
    if (key.leftArrow) {
      setActiveTab((prev) => (prev > 0 ? prev - 1 : TABS.length - 1));
    }
    if (key.rightArrow) {
      setActiveTab((prev) => (prev < TABS.length - 1 ? prev + 1 : 0));
    }
  });

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold color="cyan">agents-ui</Text>
        <Text color={connected ? "green" : "red"}>
          {connected ? "● Connected" : "○ Disconnected"}
        </Text>
      </Box>

      <TabBar tabs={TABS} activeIndex={activeTab} />

      {/* Content */}
      <Box flexGrow={1}>
        {activeTab === 0 && (
          <SessionList sessions={sessionList} selectedIndex={selectedSession} />
        )}
        {activeTab === 1 && (
          <AgentTreeView session={currentSession} selectedIndex={selectedAgent} />
        )}
        {activeTab === 2 && <ActivityFeed events={sessionActivity} />}
        {activeTab === 3 && <TokenDashboard session={currentSession} />}
      </Box>

      {/* Footer */}
      <Box paddingX={1} borderStyle="single" borderTop borderColor="gray">
        <Text dimColor>
          ↑↓ {activeTab === 0 ? "select session" : activeTab === 1 ? "select agent" : "scroll"}  ←→ switch tab  1-4 jump to tab  q quit
        </Text>
      </Box>
    </Box>
  );
}
