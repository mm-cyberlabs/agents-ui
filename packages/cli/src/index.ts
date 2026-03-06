#!/usr/bin/env node

import { Command } from "commander";
import { createApp } from "@agents-ui/server";
import { installHooks, removeHooks } from "./setup/hook-config.js";
import { installLaunchAgent, removeLaunchAgent } from "./setup/launch-agent.js";

const program = new Command()
  .name("agents-ui")
  .description("Real-time Claude Code agent monitor")
  .version("0.1.0");

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

    await installLaunchAgent(port);
    console.log(`Background server installed and started (LaunchAgent)`);
    console.log(`\nServer running at http://127.0.0.1:${port}`);
    console.log(`Run 'agents-ui' to open the TUI, or 'agents-ui web' for the browser UI.`);
  });

program
  .command("teardown")
  .description("Remove Claude Code HTTP hooks")
  .option("-p, --port <port>", "Server port", "40110")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    await removeHooks(port);
    console.log(`HTTP hooks removed from ~/.claude/settings.json`);

    await removeLaunchAgent();
    console.log(`Background server stopped and removed (LaunchAgent)`);
  });

program.parse();
