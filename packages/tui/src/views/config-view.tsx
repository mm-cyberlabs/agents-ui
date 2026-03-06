import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { InstalledConfig, InstalledAgent, InstalledSkill } from "@agents-ui/core";

interface ConfigViewProps {
  serverUrl: string;
}

export function ConfigView({ serverUrl }: ConfigViewProps) {
  const [config, setConfig] = useState<InstalledConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const httpUrl = serverUrl
      .replace(/^ws:\/\//, "http://")
      .replace(/^wss:\/\//, "https://")
      .replace(/\/ws$/, "/api/config");

    fetch(httpUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setConfig(data as InstalledConfig))
      .catch((err) => setError(String(err)));
  }, [serverUrl]);

  if (error) {
    return (
      <Box padding={1}>
        <Text color="red">Failed to load config: {error}</Text>
      </Box>
    );
  }

  if (!config) {
    return (
      <Box padding={1}>
        <Text dimColor>Loading config...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Installed Agents */}
      <Text bold color="#E67D22">Installed Agents</Text>
      {config.agents.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No agents installed.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {config.agents.map((agent: InstalledAgent) => (
            <Box key={agent.name} flexDirection="column" marginBottom={1}>
              <Box gap={1}>
                <Text bold color="cyan">{agent.name}</Text>
                {agent.model && (
                  <Text color="gray">[{agent.model}]</Text>
                )}
                {agent.memory && (
                  <Text color="gray">memory={agent.memory}</Text>
                )}
              </Box>
              <Text dimColor>  {agent.description}</Text>
              <Text dimColor>  {agent.filePath}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Installed Skills */}
      <Box marginTop={1}>
        <Text bold color="#E67D22">Installed Skills</Text>
      </Box>
      {config.skills.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No skills installed.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {config.skills.map((skill: InstalledSkill) => (
            <Box key={skill.name} flexDirection="column" marginBottom={1}>
              <Box gap={1}>
                <Text bold color="yellow">{skill.name}</Text>
                {skill.agent && (
                  <Text color="gray">agent={skill.agent}</Text>
                )}
                {skill.context && (
                  <Text color="gray">context={skill.context}</Text>
                )}
              </Box>
              <Text dimColor>  {skill.description}</Text>
              {skill.allowedTools && skill.allowedTools.length > 0 && (
                <Text dimColor>  tools: {skill.allowedTools.join(", ")}</Text>
              )}
              <Text dimColor>  {skill.dirPath}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
