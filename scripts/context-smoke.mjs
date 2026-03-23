#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

const rootDir = resolve(import.meta.dirname, "..");
const runnerPath = resolve(rootDir, "scripts", "run-workspace-entry.mjs");
const contextRoot = resolve(rootDir, ".trellis", "tmp");
let contextHome = "";
let contextEnv = {};

async function main() {
  try {
    await createContextSandbox();
    const bindAvailable = await canBindIpc();

    await step("Context host status", async () => {
      const statusJson = await runEntry("packages/cli/src/bin/actant.ts", ["hub", "status", "-f", "json"]);
      console.log(statusJson);
      assertIncludes(statusJson, '"active": true');
      assertIncludes(statusJson, `"projectRoot": "${escapeForJson(rootDir)}"`);
    });

    await step("Hub read project context", async () => {
      const contextJson = await runEntry("packages/cli/src/bin/actant.ts", ["hub", "read", "/project/context.json"]);
      console.log(contextJson);
      assertIncludes(contextJson, '"mode": "namespace-context"');
    });

    await step("Hub list skills", async () => {
      const skillsOut = await runEntry("packages/cli/src/bin/actant.ts", ["hub", "list", "/skills"]);
      console.log(skillsOut);
      assertIncludes(skillsOut, "_catalog.json");
    });

    await step("acthub alias", async () => {
      const aliasJson = await runEntry("packages/cli/src/bin/acthub.ts", ["status", "-f", "json"]);
      console.log(aliasJson);
      assertIncludes(aliasJson, '"active": true');
    });

    if (bindAvailable) {
      await step("MCP connected path", async () => {
        const connectedOut = await runEntry("packages/mcp-server/src/index.ts", [], { allowFailure: true });
        console.log(connectedOut);
        assertIncludes(connectedOut, "connected to daemon");
      });
    } else {
      await step("MCP connected path skipped (IPC bind unavailable in this environment)", async () => {
        console.log("Skipped connected MCP verification because local IPC listen is not permitted in this environment.");
      });
    }

    await step("MCP standalone fallback with invalid socket", async () => {
      const standaloneOut = await runEntry("packages/mcp-server/src/index.ts", [], {
        allowFailure: true,
        env: {
          ACTANT_SOCKET: "/tmp/actant-context-smoke-missing.sock",
        },
      });
      console.log(standaloneOut);
      assertIncludes(standaloneOut, "standalone namespace mode");
    });

    console.log("Context smoke passed.");
  } finally {
    await stopDaemon();
    await cleanupContextSandbox();
  }
}

async function step(label, fn) {
  const index = ++step.current;
  console.log(`[${index}/6] ${label}`);
  await fn();
}

step.current = 0;

async function stopDaemon() {
  try {
    await runEntry("packages/cli/src/bin/actant.ts", ["daemon", "stop"], { allowFailure: true, silent: true });
  } catch {
    // Best-effort cleanup.
  }
}

function assertIncludes(output, expected) {
  if (!output.includes(expected)) {
    throw new Error(`Expected output to include ${JSON.stringify(expected)}`);
  }
}

function escapeForJson(value) {
  return value.replace(/\\/g, "\\\\");
}

async function createContextSandbox() {
  await mkdir(contextRoot, { recursive: true });
  contextHome = await mkdtemp(join(contextRoot, "context-smoke-"));
  contextEnv = {
    ACTANT_HOME: contextHome,
    ACTANT_SOCKET: getIpcPath(contextHome),
  };
}

async function cleanupContextSandbox() {
  if (!contextHome) return;
  await rm(contextHome, { recursive: true, force: true });
}

function getIpcPath(homeDir) {
  if (process.platform === "win32") {
    const raw = homeDir.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeName = raw.length > 80
      ? `${raw.slice(0, 48)}-${createHash("md5").update(homeDir).digest("hex").slice(0, 16)}`
      : raw;
    return `\\\\.\\pipe\\actant-${safeName}`;
  }

  return join(homeDir, "actant.sock");
}

function canBindIpc() {
  const socketPath = contextEnv.ACTANT_SOCKET;
  return new Promise((resolvePromise) => {
    const server = createServer();
    const finish = (result) => {
      server.removeAllListeners();
      resolvePromise(result);
    };

    server.once("error", () => {
      finish(false);
    });

    server.listen(socketPath, () => {
      server.close(() => {
        finish(true);
      });
    });
  });
}

function runEntry(entry, args, options = {}) {
  const { allowFailure = false, env = {}, silent = false } = options;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [runnerPath, entry, ...args], {
      cwd: rootDir,
      env: {
        ...process.env,
        ...contextEnv,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code, signal) => {
      const combined = `${stdout}${stderr}`;
      if (code === 0 || allowFailure) {
        resolvePromise(combined.trim());
        return;
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      const suffix = silent || combined.trim().length === 0 ? "" : `\n${combined.trimEnd()}`;
      rejectPromise(new Error(`Command failed for ${entry} (${reason})${suffix}`));
    });
  });
}

await main();
