import { writeFile, unlink, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const LABEL = "com.agents-ui.server";
const PLIST_NAME = `${LABEL}.plist`;

function getLaunchAgentsDir(): string {
  return join(homedir(), "Library", "LaunchAgents");
}

function getPlistPath(): string {
  return join(getLaunchAgentsDir(), PLIST_NAME);
}

function getLogPath(): string {
  return join(homedir(), ".claude", "agents-ui-server.log");
}

function buildPlist(port: number): string {
  // Use the current node binary and script path so the LaunchAgent
  // runs the same installation the user set up.
  const nodeBin = process.execPath;
  const scriptPath = process.argv[1];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeBin}</string>
    <string>${scriptPath}</string>
    <string>serve</string>
    <string>--port</string>
    <string>${port}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${getLogPath()}</string>
  <key>StandardErrorPath</key>
  <string>${getLogPath()}</string>
</dict>
</plist>
`;
}

/**
 * Install and load the LaunchAgent so the server runs persistently.
 */
export async function installLaunchAgent(port: number): Promise<void> {
  const plistPath = getPlistPath();

  // Ensure ~/Library/LaunchAgents exists
  await mkdir(getLaunchAgentsDir(), { recursive: true });

  // Unload existing agent if present (ignore errors if not loaded)
  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null`);
  } catch {
    // Not loaded, that's fine
  }

  await writeFile(plistPath, buildPlist(port), "utf-8");
  execSync(`launchctl load "${plistPath}"`);
}

/**
 * Unload and remove the LaunchAgent.
 */
export async function removeLaunchAgent(): Promise<void> {
  const plistPath = getPlistPath();

  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null`);
  } catch {
    // Not loaded
  }

  try {
    await unlink(plistPath);
  } catch {
    // File doesn't exist
  }
}
