import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { platform, homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { getSettingsPath } from "@agents-ui/core";

interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

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

function icon(status: HealthCheck["status"]): string {
  switch (status) {
    case "ok":
      return "\x1b[32m✓\x1b[0m"; // green
    case "warn":
      return "\x1b[33m!\x1b[0m"; // yellow
    case "fail":
      return "\x1b[31m✗\x1b[0m"; // red
  }
}

async function checkServer(port: number): Promise<HealthCheck> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const body = (await res.json()) as { status: string };
      return { name: "Server", status: "ok", detail: `Running on port ${port} (${body.status})` };
    }
    return { name: "Server", status: "fail", detail: `Responded with HTTP ${res.status}` };
  } catch {
    return { name: "Server", status: "fail", detail: `Not reachable on port ${port}` };
  }
}

async function checkWebSocket(port: number): Promise<HealthCheck> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ name: "WebSocket", status: "fail", detail: "Connection timed out" });
    }, 3000);

    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({ name: "WebSocket", status: "ok", detail: `Connected to ws://127.0.0.1:${port}/ws` });
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        resolve({ name: "WebSocket", status: "fail", detail: "Connection refused" });
      };
    } catch {
      clearTimeout(timeout);
      resolve({ name: "WebSocket", status: "fail", detail: "Connection refused" });
    }
  });
}

async function checkWebDashboard(port: number): Promise<HealthCheck> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        return { name: "Web Dashboard", status: "ok", detail: `Serving at http://127.0.0.1:${port}` };
      }
    }
    return { name: "Web Dashboard", status: "warn", detail: "Server running but web assets not found (run: pnpm --filter @agents-ui/web run build)" };
  } catch {
    return { name: "Web Dashboard", status: "fail", detail: "Server not reachable" };
  }
}

async function checkHooks(port: number): Promise<HealthCheck> {
  const settingsPath = getSettingsPath();
  try {
    const content = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content) as { hooks?: Record<string, unknown[]> };
    const hooks = settings.hooks ?? {};

    const expectedBase = `http://localhost:${port}/api/hooks/`;
    let found = 0;

    for (const event of HOOK_EVENTS) {
      const entries = hooks[event];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const rec = entry as { hooks?: Array<{ type: string; url: string }> };
        if (!Array.isArray(rec.hooks)) continue;
        for (const h of rec.hooks) {
          if (h.type === "http" && h.url?.startsWith(expectedBase)) {
            found++;
            break;
          }
        }
      }
    }

    if (found === HOOK_EVENTS.length) {
      return { name: "Hooks", status: "ok", detail: `All ${found}/${HOOK_EVENTS.length} hooks configured for port ${port}` };
    } else if (found > 0) {
      return { name: "Hooks", status: "warn", detail: `${found}/${HOOK_EVENTS.length} hooks configured (run: agents-ui setup)` };
    } else {
      return { name: "Hooks", status: "fail", detail: "No hooks configured (run: agents-ui setup)" };
    }
  } catch {
    return { name: "Hooks", status: "fail", detail: `Settings file not found at ${settingsPath}` };
  }
}

function checkBackgroundService(): HealthCheck {
  if (platform() === "win32") {
    try {
      const output = execSync('schtasks /query /tn "AgentsUI-Server" 2>&1', { encoding: "utf-8" });
      if (output.includes("Running")) {
        return { name: "Background Service", status: "ok", detail: "Windows Task Scheduler: running" };
      }
      return { name: "Background Service", status: "warn", detail: "Windows Task Scheduler: registered but not running" };
    } catch {
      return { name: "Background Service", status: "fail", detail: "Windows Task not found (run: agents-ui setup)" };
    }
  }

  // macOS LaunchAgent
  const plistPath = join(homedir(), "Library", "LaunchAgents", "com.agents-ui.server.plist");
  if (!existsSync(plistPath)) {
    return { name: "Background Service", status: "fail", detail: "LaunchAgent not installed (run: agents-ui setup)" };
  }

  try {
    const output = execSync("launchctl list 2>/dev/null", { encoding: "utf-8" });
    if (output.includes("com.agents-ui.server")) {
      return { name: "Background Service", status: "ok", detail: "LaunchAgent: loaded and running" };
    }
    return { name: "Background Service", status: "warn", detail: "LaunchAgent: plist exists but not loaded" };
  } catch {
    return { name: "Background Service", status: "warn", detail: "LaunchAgent: could not query launchctl" };
  }
}

export async function runHealthCheck(port: number): Promise<void> {
  console.log(`\nagents-ui health check (port ${port})\n`);

  const results = await Promise.all([
    checkServer(port),
    checkWebSocket(port),
    checkWebDashboard(port),
    checkHooks(port),
    Promise.resolve(checkBackgroundService()),
  ]);

  const maxNameLen = Math.max(...results.map((r) => r.name.length));

  for (const r of results) {
    const pad = " ".repeat(maxNameLen - r.name.length);
    console.log(`  ${icon(r.status)} ${r.name}${pad}  ${r.detail}`);
  }

  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warn").length;

  console.log();
  if (failCount === 0 && warnCount === 0) {
    console.log("\x1b[32mAll systems operational.\x1b[0m\n");
  } else if (failCount === 0) {
    console.log(`\x1b[33m${warnCount} warning(s), no failures.\x1b[0m\n`);
  } else {
    console.log(`\x1b[31m${failCount} failure(s)\x1b[0m${warnCount > 0 ? `, \x1b[33m${warnCount} warning(s)\x1b[0m` : ""}.\n`);
    process.exitCode = 1;
  }
}
