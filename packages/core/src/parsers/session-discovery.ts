import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { getProjectsDir, getProjectDisplayName, getSubagentsDir } from "../utils/paths.js";

export interface DiscoveredSession {
  sessionId: string;
  projectDir: string; // encoded dir name
  projectName: string; // display name
  jsonlPath: string;
  lastModified: Date;
  hasSubagents: boolean;
  subagentPaths: string[];
}

/**
 * Scan ~/.claude/projects/ for all session JSONL files.
 * Returns sessions sorted by last modified (newest first).
 */
export async function discoverSessions(): Promise<DiscoveredSession[]> {
  const projectsDir = getProjectsDir();
  const sessions: DiscoveredSession[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return [];
  }

  for (const projectDir of projectDirs) {
    if (projectDir === "." || projectDir === ".." || projectDir === "ssh-sessions") continue;

    const projectPath = join(projectsDir, projectDir);
    let entries: string[];
    try {
      entries = await readdir(projectPath);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) continue;

      const sessionId = entry.replace(".jsonl", "");
      const jsonlPath = join(projectPath, entry);

      let fileStat;
      try {
        fileStat = await stat(jsonlPath);
      } catch {
        continue;
      }

      // Check for subagent transcripts
      const subagentPaths: string[] = [];
      const subagentsDir = getSubagentsDir(projectDir, sessionId);
      try {
        const subEntries = await readdir(subagentsDir);
        for (const sub of subEntries) {
          if (sub.endsWith(".jsonl")) {
            subagentPaths.push(join(subagentsDir, sub));
          }
        }
      } catch {
        // No subagents directory
      }

      sessions.push({
        sessionId,
        projectDir,
        projectName: getProjectDisplayName(projectDir),
        jsonlPath,
        lastModified: fileStat.mtime,
        hasSubagents: subagentPaths.length > 0,
        subagentPaths,
      });
    }
  }

  sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return sessions;
}

/**
 * Discover sessions for a specific project directory.
 */
export async function discoverProjectSessions(projectDir: string): Promise<DiscoveredSession[]> {
  const all = await discoverSessions();
  return all.filter((s) => s.projectDir === projectDir);
}
