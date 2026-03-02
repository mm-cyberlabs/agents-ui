import { homedir } from "node:os";
import { join } from "node:path";

export function getClaudeDir(): string {
  return join(homedir(), ".claude");
}

export function getProjectsDir(): string {
  return join(getClaudeDir(), "projects");
}

export function getHistoryPath(): string {
  return join(getClaudeDir(), "history.jsonl");
}

export function getSettingsPath(): string {
  return join(getClaudeDir(), "settings.json");
}

/**
 * Decode an encoded project directory name back to the original absolute path.
 * Claude Code encodes paths by replacing "/" with "-".
 * e.g. "-Users-jrmartinez-git-feed-log" → "/Users/jrmartinez/git/feed-log"
 *
 * Note: This is ambiguous if directory names contain hyphens. We rely on
 * reading `cwd` from the first JSONL message for the authoritative path.
 */
export function decodeProjectDir(encoded: string): string {
  if (!encoded.startsWith("-")) return encoded;
  return encoded.replace(/-/g, "/");
}

/**
 * Get a display-friendly project name from an encoded directory name.
 * Returns the last path segment of the decoded path.
 */
export function getProjectDisplayName(encoded: string): string {
  const decoded = decodeProjectDir(encoded);
  const segments = decoded.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? encoded;
}

/**
 * Get the subagents directory for a given session.
 */
export function getSubagentsDir(projectDir: string, sessionId: string): string {
  return join(getProjectsDir(), projectDir, sessionId, "subagents");
}
