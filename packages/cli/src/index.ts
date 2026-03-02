#!/usr/bin/env node

import { Command } from "commander";
import { createApp } from "@agents-ui/server";
import { installHooks, removeHooks } from "./setup/hook-config.js";

const program = new Command()
  .name("agents-ui")
  .description("Real-time Claude Code agent monitor")
  .version("0.1.0");

program
  .command("start", { isDefault: true })
  .description("Start the monitoring server and TUI")
  .option("-p, --port <port>", "Server port", "47860")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    console.log(`Starting agents-ui server on port ${port}...`);
    const { app } = await createApp({ port });
    console.log(`Server running at http://127.0.0.1:${port}`);
    console.log(`WebSocket at ws://127.0.0.1:${port}/ws`);
    console.log(`Monitoring ~/.claude/projects/ for sessions...\n`);

    // Dynamically import TUI to avoid loading Ink unless needed
    const { startTui } = await import("@agents-ui/tui");
    await startTui(`ws://127.0.0.1:${port}/ws`);

    await app.close();
  });

program
  .command("web")
  .description("Start the monitoring server and open the web UI")
  .option("-p, --port <port>", "Server port", "47860")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    console.log(`Starting agents-ui server on port ${port}...`);
    await createApp({ port });
    console.log(`Server running at http://127.0.0.1:${port}`);
    console.log(`WebSocket at ws://127.0.0.1:${port}/ws`);
    console.log(`\nOpen http://127.0.0.1:${port} in your browser`);

    const open = await import("open");
    await open.default(`http://127.0.0.1:${port}`);

    // Keep the process alive
    await new Promise(() => {});
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
    console.log(`\nRun 'agents-ui' to start the monitoring server.`);
  });

program
  .command("teardown")
  .description("Remove Claude Code HTTP hooks")
  .option("-p, --port <port>", "Server port", "47860")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    await removeHooks(port);
    console.log(`HTTP hooks removed from ~/.claude/settings.json`);
  });

program.parse();
