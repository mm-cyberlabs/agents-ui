import React from "react";
import { render } from "ink";
import { App } from "./app.js";

export async function startTui(serverUrl = "ws://127.0.0.1:40110/ws") {
  const { unmount, waitUntilExit } = render(<App serverUrl={serverUrl} />);

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    cleanup();
  });

  await waitUntilExit();
  cleanup();
}

function cleanup() {
  // Clear Ink output, restore terminal, show cursor
  process.stdout.write("\x1B[?25h");  // show cursor
  process.stdout.write("\x1B[2J");    // clear screen
  process.stdout.write("\x1B[H");     // move cursor to top-left
  process.exit(0);
}
