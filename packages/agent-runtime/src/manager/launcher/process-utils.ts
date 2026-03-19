import { execSync } from "node:child_process";

/**
 * Check whether a process with the given PID is still alive.
 * Uses `kill(pid, 0)` which sends no signal but checks existence.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ESRCH") {
      return false;
    }
    if (isNodeError(err) && err.code === "EPERM") {
      return true;
    }
    return false;
  }
}

/**
 * Send a signal to a process, ignoring ESRCH (already dead).
 * Returns true if the signal was delivered, false if the process was already gone.
 */
export function sendSignal(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ESRCH") {
      return false;
    }
    throw err;
  }
}

/**
 * Kill a process and its entire tree (children, grandchildren, etc.).
 * On Windows, `process.kill()` only terminates the direct process.
 * `taskkill /T /F` recursively kills the whole tree.
 */
export function killProcessTree(pid: number): boolean {
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /T /F /PID ${pid}`, { stdio: "ignore" });
      return true;
    } catch {
      return sendSignal(pid, "SIGKILL");
    }
  }
  return sendSignal(pid, "SIGKILL");
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
