#!/usr/bin/env node

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { createApp } from "@agents-ui/server";
import { installHooks, removeHooks } from "./setup/hook-config.js";
import { installService, removeService } from "./setup/launch-agent.js";
import { runHealthCheck } from "./health.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");

const program = new Command()
  .name("agents-ui")
  .description("Real-time Claude Code agent monitor")
  .version("0.2.0");

async function ensureServer(port: number): Promise<void> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (res.ok) return; // Server already running
  } catch {
    // Server not running, start it
  }

  console.log(`Starting background server on port ${port}...`);
  const { app } = await createApp({ port });

  // Keep server alive in the background (won't block since TUI takes over)
  process.on("exit", () => app.close());
}

program
  .command("start", { isDefault: true })
  .description("Open the TUI (starts server if needed)")
  .option("-p, --port <port>", "Server port", "40110")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    await ensureServer(port);

    const wsUrl = `ws://127.0.0.1:${port}/ws`;
    const { startTui } = await import("@agents-ui/tui");
    await startTui(wsUrl);
  });

program
  .command("serve")
  .description("Run the server headlessly (used by LaunchAgent)")
  .option("-p, --port <port>", "Server port", "40110")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    await createApp({ port });
    console.log(`agents-ui server running on port ${port}`);

    // Keep the process alive
    await new Promise(() => {});
  });

program
  .command("web")
  .description("Open the web UI in a browser (server must be running)")
  .option("-p, --port <port>", "Server port", "40110")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const open = await import("open");
    await open.default(`http://127.0.0.1:${port}`);
    console.log(`Opened http://127.0.0.1:${port} in your browser`);
  });

program
  .command("setup")
  .description("Configure Claude Code HTTP hooks for real-time monitoring")
  .option("-p, --port <port>", "Server port", "40110")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    await installHooks(port);
    console.log(`HTTP hooks configured in ~/.claude/settings.json`);
    console.log(`Hooks will POST to http://localhost:${port}/api/hooks/*`);

    await installService(port);
    console.log(`Background server installed and started`);
    console.log(`\nServer running at http://127.0.0.1:${port}`);
    console.log(`Run 'agents-ui' to open the TUI, or 'agents-ui web' for the browser UI.`);
  });

program
  .command("health")
  .description("Check the health of all agents-ui components")
  .option("-p, --port <port>", "Server port", "40110")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    await runHealthCheck(port);
  });

program
  .command("update")
  .description("Pull latest code, rebuild, and restart the server")
  .option("-p, --port <port>", "Server port", "40110")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);

    console.log("Pulling latest changes...");
    try {
      execSync("git pull --ff-only", { cwd: REPO_ROOT, stdio: "inherit" });
    } catch {
      console.error("Failed to pull. Resolve conflicts and try again.");
      process.exit(1);
    }

    console.log("\nInstalling dependencies...");
    execSync("pnpm install", { cwd: REPO_ROOT, stdio: "inherit" });

    console.log("\nBuilding...");
    execSync("pnpm run build", { cwd: REPO_ROOT, stdio: "inherit" });

    console.log("\nRestarting server...");
    await removeService();
    await installService(port);

    console.log("\nUpdate complete! Server restarted.");
  });

program
  .command("teardown")
  .description("Remove Claude Code HTTP hooks")
  .option("-p, --port <port>", "Server port", "40110")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    await removeHooks(port);
    console.log(`HTTP hooks removed from ~/.claude/settings.json`);

    await removeService();
    console.log(`Background server stopped and removed`);
  });

program.parse();
