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
export async function installHooks(port = 40110): Promise<void> {
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

  // Clean up any existing agents-ui hooks (from previous installs on different ports)
  for (const event of HOOK_EVENTS) {
    const existing = hooks[event];
    if (!Array.isArray(existing)) continue;
    hooks[event] = existing.filter((entry) => {
      const rec = entry as Record<string, unknown>;
      if (!Array.isArray(rec.hooks)) return true;
      rec.hooks = (rec.hooks as Array<Record<string, unknown>>).filter(
        (h) => !(h.type === "http" && typeof h.url === "string" && (h.url as string).includes("/api/hooks/")),
      );
      return (rec.hooks as unknown[]).length > 0;
    });
    if (hooks[event].length === 0) delete hooks[event];
  }

  // Add fresh hooks for the current port
  for (const event of HOOK_EVENTS) {
    const hookUrl = buildHookUrl(baseUrl, event);
    const newEntry = {
      hooks: [{ type: "http", url: hookUrl, timeout: 5 }],
    };
    hooks[event] = [...(hooks[event] ?? []), newEntry];
  }

  settings.hooks = hooks;
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

/**
 * Remove agents-ui HTTP hooks from ~/.claude/settings.json.
 */
export async function removeHooks(port = 40110): Promise<void> {
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
