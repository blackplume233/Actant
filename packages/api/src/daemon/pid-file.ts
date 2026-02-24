import { writeFile, readFile, unlink } from "node:fs/promises";

export async function writePidFile(path: string): Promise<void> {
  await writeFile(path, String(process.pid), "utf-8");
}

export async function readPidFile(path: string): Promise<number | null> {
  try {
    const content = await readFile(path, "utf-8");
    const pid = parseInt(content.trim(), 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export async function removePidFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // file may not exist
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
