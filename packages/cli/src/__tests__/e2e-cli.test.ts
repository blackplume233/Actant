import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Daemon } from "@agentcraft/api";

const CLI_BIN = join(import.meta.dirname, "..", "..", "dist", "bin", "agentcraft.js");

function runCli(args: string[], socketPath: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child: ChildProcess = spawn("node", [CLI_BIN, ...args], {
      env: {
        ...process.env,
        AGENTCRAFT_SOCKET: socketPath,
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
    }, 10_000);
  });
}

describe("CLI E2E (stdio)", () => {
  let tmpDir: string;
  let daemon: Daemon;
  let socketPath: string;
  let fixtureFile: string;

  const validTemplate = {
    name: "e2e-tpl",
    version: "1.0.0",
    backend: { type: "cursor" },
    provider: { type: "anthropic" },
    domainContext: {},
  };

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ac-cli-e2e-"));
    daemon = new Daemon({ homeDir: tmpDir });
    await daemon.start();
    socketPath = daemon.socketPath;

    fixtureFile = join(tmpDir, "e2e-tpl.json");
    await writeFile(fixtureFile, JSON.stringify(validTemplate));
  });

  afterAll(async () => {
    await daemon.stop();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("--help shows usage", async () => {
    const { stdout, exitCode } = await runCli(["--help"], socketPath);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("AgentCraft");
    expect(stdout).toContain("template");
    expect(stdout).toContain("agent");
    expect(stdout).toContain("daemon");
  });

  it("--version shows version", async () => {
    const { stdout, exitCode } = await runCli(["--version"], socketPath);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("0.1.0");
  });

  it("daemon status shows running", async () => {
    const { stdout, exitCode } = await runCli(["daemon", "status", "-f", "json"], socketPath);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.running).toBe(true);
    expect(result.version).toBe("0.1.0");
  });

  it("template list shows empty list", async () => {
    const { stdout, exitCode } = await runCli(["template", "list", "-f", "json"], socketPath);
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual([]);
  });

  it("template validate reports valid file", async () => {
    const { stdout, exitCode } = await runCli(["template", "validate", fixtureFile], socketPath);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid");
    expect(stdout).toContain("e2e-tpl");
  });

  it("template load persists template", async () => {
    const { stdout, exitCode } = await runCli(["template", "load", fixtureFile], socketPath);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Loaded");

    const { stdout: listOut } = await runCli(["template", "list", "-f", "quiet"], socketPath);
    expect(listOut.trim()).toBe("e2e-tpl");
  });

  it("template show displays detail", async () => {
    const { stdout, exitCode } = await runCli(["template", "show", "e2e-tpl", "-f", "json"], socketPath);
    expect(exitCode).toBe(0);
    const tpl = JSON.parse(stdout);
    expect(tpl.name).toBe("e2e-tpl");
    expect(tpl.version).toBe("1.0.0");
  });

  it("agent create + list + destroy lifecycle", async () => {
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
    const { stderr, exitCode } = await runCli(["agent", "start", "nonexistent"], socketPath);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });

  it("error: template not found exits with code 1", async () => {
    const { stderr, exitCode } = await runCli(["template", "show", "nonexistent"], socketPath);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });

  it("destroy without --force warns and exits 1", async () => {
    await runCli(["agent", "create", "warn-agent", "-t", "e2e-tpl"], socketPath);

    const { stdout, exitCode } = await runCli(["agent", "destroy", "warn-agent"], socketPath);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("--force");

    await runCli(["agent", "destroy", "warn-agent", "--force"], socketPath);
  });
});
