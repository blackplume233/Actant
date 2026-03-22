import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, writeFile, rm, access, realpath, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { Daemon } from "@actant/api";
import { getDefaultIpcPath, normalizeIpcPath } from "@actant/shared";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const SOURCE_RUNNER = join(REPO_ROOT, "scripts", "run-workspace-entry.mjs");
const CLI_BIN = join(import.meta.dirname, "..", "..", "dist", "bin", "actant.js");
const ACTHUB_BIN = join(import.meta.dirname, "..", "..", "dist", "bin", "acthub.js");
const CLI_SOURCE_ENTRY = "packages/cli/src/bin/actant.ts";
const ACTHUB_SOURCE_ENTRY = "packages/cli/src/bin/acthub.ts";
const USE_DIST = process.env["ACTANT_E2E_USE_DIST"] === "1";
const CLI_RUN_TIMEOUT_MS = 25_000;

function resolveCommandArgs(binPath: string, args: string[]): string[] {
  const sourceEntry = binPath === ACTHUB_BIN ? ACTHUB_SOURCE_ENTRY : CLI_SOURCE_ENTRY;
  if (USE_DIST && existsSync(binPath)) {
    return [binPath, ...args];
  }
  return [SOURCE_RUNNER, sourceEntry, ...args];
}

function runCli(
  args: string[],
  socketPath: string,
  extraEnv?: Record<string, string | undefined>,
  binPath = CLI_BIN,
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const commandArgs = resolveCommandArgs(binPath, args);
    const child: ChildProcess = spawn(process.execPath, commandArgs, {
      cwd,
      env: {
        ...process.env,
        ...extraEnv,
        ACTANT_SOCKET: socketPath,
        LOG_LEVEL: "silent",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, exitCode: -1 });
    }, CLI_RUN_TIMEOUT_MS);
  });
}

async function normalizeFsPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}

describe("CLI E2E (stdio)", { timeout: 40_000 }, () => {
  let tmpDir: string;
  let daemon: Daemon | undefined;
  let daemonAvailable = false;
  let socketPath: string;
  let fixtureFile: string;

  const validTemplate = {
    name: "e2e-tpl",
    version: "1.0.0",
    backend: { type: "claude-code" },
    provider: { type: "anthropic" },
    project: {},
  };

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ac-cli-e2e-"));
    tmpDir = await realpath(tmpDir);
    daemon = new Daemon({ homeDir: tmpDir, launcherMode: "mock" });
    try {
      await daemon.start();
      daemonAvailable = true;
      socketPath = daemon.socketPath;
    } catch (err) {
      if (!isSocketPermissionError(err)) {
        throw err;
      }

      // Some sandboxed runners forbid Unix socket listeners entirely.
      // Keep the hub fallback assertions active with a deterministic socket path.
      socketPath = getDefaultIpcPath(tmpDir);
      daemon = undefined;
    }

    fixtureFile = join(tmpDir, "e2e-tpl.json");
    await mkdir(join(tmpDir, "configs"), { recursive: true });
    await writeFile(fixtureFile, JSON.stringify(validTemplate));
    await writeFile(
      join(tmpDir, "actant.namespace.json"),
      JSON.stringify({
        version: 1,
        name: "e2e-project",
        mounts: [
          { type: "hostfs", path: "/workspace", options: { hostPath: "." } },
          { type: "hostfs", path: "/config", options: { hostPath: "configs" } },
        ],
      }),
      "utf-8",
    );
    await writeFile(join(tmpDir, "README.md"), "# E2E Project\n", "utf-8");
  });

  afterAll(async () => {
    if (daemonAvailable) {
      await daemon?.stop();
    }
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("--help shows usage", async () => {
    if (!daemonAvailable) return;
    const { stdout, exitCode } = await runCli(["--help"], socketPath);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Actant");
    expect(stdout).toContain("template");
    expect(stdout).toContain("agent");
    expect(stdout).toContain("daemon");
  });

  it("--version shows version", async () => {
    if (!daemonAvailable) return;
    const { stdout, exitCode } = await runCli(["--version"], socketPath);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("daemon status shows running", async () => {
    if (!daemonAvailable) return;
    const { stdout, exitCode } = await runCli(["daemon", "status", "-f", "json"], socketPath);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout) as { running: boolean; version: string };
    expect(result.running).toBe(true);
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("daemon status shows running after foreground start with .sock override", async () => {
    if (!daemonAvailable) return;
    if (process.platform !== "win32") {
      return;
    }

    const foregroundHome = await mkdtemp(join(tmpdir(), "ac-cli-foreground-"));
    const socketOverride = ".sock";
    const expectedSocketPath = getDefaultIpcPath(foregroundHome);
    const normalizedOverride = normalizeIpcPath(socketOverride, foregroundHome);
    expect(normalizedOverride).toBe(expectedSocketPath);
    const pidFile = join(foregroundHome, "daemon.pid");
    const foregroundArgs = resolveCommandArgs(CLI_BIN, ["daemon", "start", "--foreground"]);
    const child = spawn(process.execPath, foregroundArgs, {
      env: {
        ...process.env,
        ACTANT_HOME: foregroundHome,
        ACTANT_SOCKET: normalizedOverride,
        ACTANT_LAUNCHER_MODE: "mock",
        LOG_LEVEL: "silent",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });

    try {
      await Promise.race([
        once(child.stdout!, "data"),
        once(child.stderr!, "data"),
      ]);

      for (let i = 0; i < 20; i++) {
        try {
          await access(pidFile);
          break;
        } catch {
          if (i === 19) {
            throw new Error(`Foreground daemon did not create pid file. stdout: ${stdout} stderr: ${stderr}`);
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const { stdout: statusOut, stderr: statusErr, exitCode } = await runCli(
        ["daemon", "status", "-f", "json"],
        normalizedOverride,
        { ACTANT_HOME: foregroundHome },
      );
      expect(exitCode, JSON.stringify({ statusErr, statusOut, stdout, stderr, expectedSocketPath }, null, 2)).toBe(0);
      const result = JSON.parse(statusOut);
      expect(result.running).toBe(true);
      expect(expectedSocketPath).toContain("actant-");
    } finally {
      child.kill("SIGINT");
      await once(child, "exit");
      await rm(foregroundHome, { recursive: true, force: true });
    }

    expect(stdout).toContain("Daemon started (foreground).");
    expect(stderr).toBe("");
  });

  it("template list shows empty list", async () => {
    if (!daemonAvailable) return;
    const { stdout, exitCode } = await runCli(["template", "list", "-f", "json"], socketPath);
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual([]);
  });

  it("template validate reports valid file", async () => {
    if (!daemonAvailable) return;
    const { stdout, exitCode } = await runCli(["template", "validate", fixtureFile], socketPath);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid");
    expect(stdout).toContain("e2e-tpl");
  });

  it("template load persists template", async () => {
    if (!daemonAvailable) return;
    const { stdout, exitCode } = await runCli(["template", "load", fixtureFile], socketPath);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Loaded");

    const { stdout: listOut } = await runCli(["template", "list", "-f", "quiet"], socketPath);
    expect(listOut.trim()).toBe("e2e-tpl");
  });

  it("template show displays detail", async () => {
    if (!daemonAvailable) return;
    const { stdout, exitCode } = await runCli(["template", "show", "e2e-tpl", "-f", "json"], socketPath);
    expect(exitCode).toBe(0);
    const tpl = JSON.parse(stdout);
    expect(tpl.name).toBe("e2e-tpl");
    expect(tpl.version).toBe("1.0.0");
  });

  it("agent create + list + destroy lifecycle", async () => {
    if (!daemonAvailable) return;
    const { stdout: createOut, exitCode: createCode } = await runCli(
      ["agent", "create", "e2e-agent", "-t", "e2e-tpl", "-f", "json"],
      socketPath,
    );
    expect(createCode).toBe(0);
    expect(createOut).toContain("e2e-agent");

    const { stdout: listOut } = await runCli(["agent", "list", "-f", "json"], socketPath);
    const agents = JSON.parse(listOut);
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe("e2e-agent");

    const { stdout: statusOut } = await runCli(["agent", "status", "e2e-agent", "-f", "json"], socketPath);
    const agent = JSON.parse(statusOut);
    expect(agent.status).toBe("created");

    const { exitCode: destroyCode } = await runCli(
      ["agent", "destroy", "e2e-agent", "--force"],
      socketPath,
    );
    expect(destroyCode).toBe(0);

    const { stdout: listAfterOut } = await runCli(["agent", "list", "-f", "json"], socketPath);
    expect(JSON.parse(listAfterOut)).toHaveLength(0);
  });

  it("agent start + stop lifecycle", async () => {
    if (!daemonAvailable) return;
    await runCli(["agent", "create", "lifecycle-agent", "-t", "e2e-tpl"], socketPath);

    const { stdout: startOut, exitCode: startCode } = await runCli(
      ["agent", "start", "lifecycle-agent"],
      socketPath,
    );
    expect(startCode).toBe(0);
    expect(startOut).toContain("Started");

    const { stdout: statusOut } = await runCli(
      ["agent", "status", "lifecycle-agent", "-f", "json"],
      socketPath,
    );
    expect(JSON.parse(statusOut).status).toBe("running");

    const { exitCode: stopCode } = await runCli(["agent", "stop", "lifecycle-agent"], socketPath);
    expect(stopCode).toBe(0);

    await runCli(["agent", "destroy", "lifecycle-agent", "--force"], socketPath);
  });

  it("error: agent not found exits with code 1", async () => {
    if (!daemonAvailable) return;
    const { stderr, exitCode } = await runCli(["agent", "start", "nonexistent"], socketPath);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });

  it("error: template not found exits with code 1", async () => {
    if (!daemonAvailable) return;
    const { stderr, exitCode } = await runCli(["template", "show", "nonexistent"], socketPath);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });

  it("destroy without --force warns and exits 1", async () => {
    if (!daemonAvailable) return;
    await runCli(["agent", "create", "warn-agent", "-t", "e2e-tpl"], socketPath);

    const { stdout, exitCode } = await runCli(["agent", "destroy", "warn-agent"], socketPath);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("--force");

    await runCli(["agent", "destroy", "warn-agent", "--force"], socketPath);
  });

  it("hub status mounts current project context", async () => {
    const { stdout, exitCode } = await runCli(
      ["hub", "status", "-f", "json"],
      socketPath,
      { ACTANT_HOME: tmpDir, ACTANT_LAUNCHER_MODE: "mock" },
      CLI_BIN,
      tmpDir,
    );
    expect(exitCode).toBe(0);
    const result = parseCliJsonOutput<{
      active: boolean;
      projectRoot: string;
      mounts: { workspace: string };
      daemonStarted: boolean;
      runtimeState: string;
    }>(stdout);
    expect(result.active).toBe(true);
    expect(await normalizeFsPath(result.projectRoot)).toBe(tmpDir);
    expect(result.mounts.workspace).toBe("/hub/workspace");
    if (!daemonAvailable) {
      expect(result.daemonStarted).toBe(false);
      expect(result.runtimeState).toBe("inactive");
    }
  });

  it("acthub alias routes to hub commands", async () => {
    const { stdout, exitCode } = await runCli(
      ["status", "-f", "json"],
      socketPath,
      { ACTANT_HOME: tmpDir, ACTANT_LAUNCHER_MODE: "mock" },
      ACTHUB_BIN,
      tmpDir,
    );
    expect(exitCode).toBe(0);
    const result = parseCliJsonOutput<{ active: boolean; projectRoot: string }>(stdout);
    expect(result.active).toBe(true);
    expect(await normalizeFsPath(result.projectRoot)).toBe(tmpDir);
  });
});

function isSocketPermissionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /listen\s+(?:eperm|eacces)|operation not permitted|permission denied/i.test(message);
}

function parseCliJsonOutput<T>(stdout: string): T {
  const jsonStart = stdout.indexOf("{");
  if (jsonStart === -1) {
    throw new Error(`Expected JSON output, received: ${stdout}`);
  }
  return JSON.parse(stdout.slice(jsonStart)) as T;
}
