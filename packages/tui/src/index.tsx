import React from "react";
import { render } from "ink";
import { App } from "./app.js";

export function startTui(serverUrl = "ws://127.0.0.1:47860/ws") {
  const { unmount, waitUntilExit } = render(<App serverUrl={serverUrl} />);

  // Handle quit
  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });

  return waitUntilExit();
}
