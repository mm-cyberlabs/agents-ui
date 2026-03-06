import { writeFile, unlink, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const TASK_NAME = "AgentsUI-Server";

function getLogPath(): string {
  return join(homedir(), ".claude", "agents-ui-server.log");
}

export async function installWindowsTask(port: number): Promise<void> {
  const nodeBin = process.execPath;
  const scriptPath = process.argv[1];

  // Remove existing task if present
  try {
    execSync(`schtasks /Delete /TN "${TASK_NAME}" /F 2>nul`, { stdio: "ignore" });
  } catch { }

  // Create the task to run at logon and restart on failure
  const command = `"${nodeBin}" "${scriptPath}" serve --port ${port}`;

  // Use schtasks to create a task that runs at logon
  execSync(
    `schtasks /Create /TN "${TASK_NAME}" /TR ${JSON.stringify(command)} /SC ONLOGON /RL HIGHEST /F`,
    { stdio: "ignore" }
  );

  // Also start it immediately
  try {
    execSync(`schtasks /Run /TN "${TASK_NAME}"`, { stdio: "ignore" });
  } catch { }
}

export async function removeWindowsTask(): Promise<void> {
  try {
    execSync(`schtasks /End /TN "${TASK_NAME}"`, { stdio: "ignore" });
  } catch { }
  try {
    execSync(`schtasks /Delete /TN "${TASK_NAME}" /F`, { stdio: "ignore" });
  } catch { }
}
