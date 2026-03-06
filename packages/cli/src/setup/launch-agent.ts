import { platform } from "node:os";

export async function installService(port: number): Promise<void> {
  if (platform() === "win32") {
    const { installWindowsTask } = await import("./service-windows.js");
    await installWindowsTask(port);
  } else {
    const { installLaunchAgent } = await import("./service-macos.js");
    await installLaunchAgent(port);
  }
}

export async function removeService(): Promise<void> {
  if (platform() === "win32") {
    const { removeWindowsTask } = await import("./service-windows.js");
    await removeWindowsTask();
  } else {
    const { removeLaunchAgent } = await import("./service-macos.js");
    await removeLaunchAgent();
  }
}
