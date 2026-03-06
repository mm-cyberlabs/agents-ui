import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getClaudeDir } from "../utils/paths.js";
import type { InstalledAgent, InstalledSkill, InstalledConfig } from "../types/agent-config.js";

/**
 * Parse YAML frontmatter from a markdown file's content.
 * Frontmatter is delimited by `---` lines at the top of the file.
 * Returns a record of key-value pairs.
 */
function parseFrontmatter(content: string): Record<string, string> {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return {};

  const result: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "---") break;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Discover installed agents from ~/.claude/agents/*.md
 */
export async function discoverInstalledAgents(): Promise<InstalledAgent[]> {
  const agentsDir = join(getClaudeDir(), "agents");
  const agents: InstalledAgent[] = [];

  let files: string[];
  try {
    files = await readdir(agentsDir);
  } catch {
    return [];
  }

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const filePath = join(agentsDir, file);
    try {
      const content = await readFile(filePath, "utf-8");
      const fm = parseFrontmatter(content);
      agents.push({
        name: fm["name"] ?? file.replace(/\.md$/, ""),
        description: fm["description"] ?? "",
        model: fm["model"] || undefined,
        memory: fm["memory"] || undefined,
        filePath,
      });
    } catch {
      // skip files that can't be read
    }
  }

  return agents;
}

/**
 * Discover installed skills from ~/.claude/skills/{name}/SKILL.md
 */
export async function discoverInstalledSkills(): Promise<InstalledSkill[]> {
  const skillsDir = join(getClaudeDir(), "skills");
  const skills: InstalledSkill[] = [];

  let dirs: string[];
  try {
    dirs = await readdir(skillsDir);
  } catch {
    return [];
  }

  for (const dir of dirs) {
    const dirPath = join(skillsDir, dir);
    const skillFile = join(dirPath, "SKILL.md");
    try {
      const content = await readFile(skillFile, "utf-8");
      const fm = parseFrontmatter(content);
      const allowedToolsRaw = fm["allowed-tools"];
      skills.push({
        name: fm["name"] ?? dir,
        description: fm["description"] ?? "",
        context: fm["context"] || undefined,
        agent: fm["agent"] || undefined,
        allowedTools: allowedToolsRaw
          ? allowedToolsRaw.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
        dirPath,
      });
    } catch {
      // skip directories without a readable SKILL.md
    }
  }

  return skills;
}

/**
 * Discover all installed agents and skills.
 */
export async function discoverInstalledConfig(): Promise<InstalledConfig> {
  const [agents, skills] = await Promise.all([
    discoverInstalledAgents(),
    discoverInstalledSkills(),
  ]);
  return { agents, skills };
}
