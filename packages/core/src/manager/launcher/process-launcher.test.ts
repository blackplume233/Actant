import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentInstanceMeta } from "@actant/shared";
import { ProcessLauncher } from "./process-launcher";
import { isProcessAlive } from "./process-utils";
import { spawn } from "node:child_process";

function makeMeta(overrides?: Partial<AgentInstanceMeta>): AgentInstanceMeta {
  const now = new Date().toISOString();
  return {
    id: "test-id",
    name: "test-agent",
    templateName: "test-tpl",
    templateVersion: "1.0.0",
    backendType: "cursor",
    interactionModes: ["start"],
    status: "starting",
    launchMode: "direct",
    workspacePolicy: "persistent",
    processOwnership: "managed",
    archetype: "repo",
    autoStart: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Spawn a long-running `node` process we can use as a test subject.
 * Returns the PID. Caller must kill it when done.
 */
function spawnSleeper(cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["-e", "setTimeout(()=>{},600000)"], {
      cwd,
      detached: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.once("spawn", () => {
      child.unref();
      if (child.pid == null) {
        reject(new Error("spawn event fired but pid is null"));
        return;
      }
      resolve(child.pid);
    });
  });
}

describe("ProcessLauncher", () => {
  let tmpDir: string;
  let launcher: ProcessLauncher;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-launcher-test-"));
    launcher = new ProcessLauncher({
      spawnVerifyDelayMs: 300,
      terminateTimeoutMs: 2000,
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("launch", () => {
    it("should launch a real process and return a valid PID", async () => {
      const meta = makeMeta({
        backendType: "custom",
        backendConfig: {
          executablePath: "node",
          args: ["-e", "setTimeout(()=>{},600000)"],
        },
      });

      const proc = await launcher.launch(tmpDir, meta);

      expect(proc.pid).toBeGreaterThan(0);
      expect(proc.workspaceDir).toBe(tmpDir);
      expect(proc.instanceName).toBe("test-agent");
      expect(isProcessAlive(proc.pid)).toBe(true);

      await launcher.terminate(proc);
    });

    it("should throw AgentLaunchError when executable does not exist", async () => {
      const meta = makeMeta({
        backendType: "custom",
        backendConfig: { executablePath: "/nonexistent/binary/path" },
      });

      await expect(launcher.launch(tmpDir, meta)).rejects.toThrow(/Failed to launch/);
    });

    it("should throw AgentLaunchError when process exits immediately", async () => {
      const meta = makeMeta({
        backendType: "custom",
        backendConfig: {
          executablePath: "node",
          args: ["-e", "process.exit(1)"],
        },
      });

      await expect(launcher.launch(tmpDir, meta)).rejects.toThrow(/Failed to launch/);
    });
  });

  describe("terminate", () => {
    it("should gracefully terminate a running process", async () => {
      const pid = await spawnSleeper(tmpDir);
      expect(isProcessAlive(pid)).toBe(true);

      const proc = { pid, workspaceDir: tmpDir, instanceName: "test-agent" };
      await launcher.terminate(proc);
      expect(isProcessAlive(pid)).toBe(false);
    });

    it("should handle terminating an already-dead process", async () => {
      const proc = {
        pid: 999999,
        workspaceDir: tmpDir,
        instanceName: "dead-agent",
      };

      await expect(launcher.terminate(proc)).resolves.toBeUndefined();
    });
  });
});
