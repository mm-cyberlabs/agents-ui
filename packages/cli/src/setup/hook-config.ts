import { readFile, writeFile } from "node:fs/promises";
import { getSettingsPath } from "@agents-ui/core";

const HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "PreToolUse",
  "PostToolUse",
  "SubagentStart",
  "SubagentStop",
  "Stop",
  "PreCompact",
] as const;

function buildHookUrl(baseUrl: string, event: string): string {
  const slug = event.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
  return `${baseUrl}/api/hooks/${slug}`;
}

/**
 * Add HTTP hook configuration to ~/.claude/settings.json.
 * Preserves existing hooks and settings.
 */
export async function installHooks(port = 47860): Promise<void> {
  const settingsPath = getSettingsPath();
  const baseUrl = `http://localhost:${port}`;

  let settings: Record<string, unknown> = {};
  try {
    const content = await readFile(settingsPath, "utf-8");
    settings = JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid JSON, start fresh
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;

  for (const event of HOOK_EVENTS) {
    const hookUrl = buildHookUrl(baseUrl, event);
    const existing = hooks[event] ?? [];

    // Check if we already have this hook URL
    const alreadyConfigured = (existing as Array<Record<string, unknown>>).some(
      (entry) =>
        Array.isArray(entry.hooks) &&
        entry.hooks.some(
          (h: Record<string, unknown>) => h.type === "http" && h.url === hookUrl,
        ),
    );

    if (!alreadyConfigured) {
      const newEntry = {
        hooks: [{ type: "http", url: hookUrl, timeout: 5 }],
      };
      hooks[event] = [...existing, newEntry];
    }
  }

  settings.hooks = hooks;
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

/**
 * Remove agents-ui HTTP hooks from ~/.claude/settings.json.
 */
export async function removeHooks(port = 47860): Promise<void> {
  const settingsPath = getSettingsPath();
  const baseUrl = `http://localhost:${port}`;

  let settings: Record<string, unknown>;
  try {
    const content = await readFile(settingsPath, "utf-8");
    settings = JSON.parse(content);
  } catch {
    return; // Nothing to remove
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;

  for (const event of HOOK_EVENTS) {
    const hookUrl = buildHookUrl(baseUrl, event);
    const existing = hooks[event];
    if (!Array.isArray(existing)) continue;

    hooks[event] = existing.filter((entry) => {
      const rec = entry as Record<string, unknown>;
      if (!Array.isArray(rec.hooks)) return true;
      const filtered = (rec.hooks as Array<Record<string, unknown>>).filter(
        (h) => !(h.type === "http" && h.url === hookUrl),
      );
      rec.hooks = filtered;
      return filtered.length > 0;
    });

    if (hooks[event].length === 0) {
      delete hooks[event];
    }
  }

  settings.hooks = hooks;
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}
