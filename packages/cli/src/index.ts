#!/usr/bin/env node

import { Command } from "commander";
import { createApp } from "@agents-ui/server";
import { installHooks, removeHooks } from "./setup/hook-config.js";
import { installLaunchAgent, removeLaunchAgent } from "./setup/launch-agent.js";

const program = new Command()
  .name("agents-ui")
  .description("Real-time Claude Code agent monitor")
  .version("0.1.0");

program
  .command("start", { isDefault: true })
  .description("Open the TUI (connects to the background server)")
  .option("-p, --port <port>", "Server port", "47860")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const wsUrl = `ws://127.0.0.1:${port}/ws`;

    // Dynamically import TUI to avoid loading Ink unless needed
    const { startTui } = await import("@agents-ui/tui");
    await startTui(wsUrl);
  });

program
  .command("serve")
  .description("Run the server headlessly (used by LaunchAgent)")
  .option("-p, --port <port>", "Server port", "47860")
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
  .option("-p, --port <port>", "Server port", "47860")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const open = await import("open");
    await open.default(`http://127.0.0.1:${port}`);
    console.log(`Opened http://127.0.0.1:${port} in your browser`);
  });

program
  .command("setup")
  .description("Configure Claude Code HTTP hooks for real-time monitoring")
  .option("-p, --port <port>", "Server port", "47860")
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
  .option("-p, --port <port>", "Server port", "47860")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    await removeHooks(port);
    console.log(`HTTP hooks removed from ~/.claude/settings.json`);

    await removeLaunchAgent();
    console.log(`Background server stopped and removed (LaunchAgent)`);
  });

program.parse();
