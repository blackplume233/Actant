/**
 * Endurance coverage: Phase 2 (REST RPC bridge)
 * Timeout and degraded behavior, daemon unavailability resilience.
 *
 * Run via: pnpm test:endurance
 *   ENDURANCE_DURATION_MS=5000 pnpm test:endurance
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RpcBridge } from "../rpc-bridge";

const DURATION_MS = parseInt(process.env.ENDURANCE_DURATION_MS ?? "5000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe("Endurance tests — REST RPC bridge (Phase 2)", () => {
  let tmpDir: string | undefined;
  let socketPath: string;

  beforeAll(async () => {
    if (process.platform === "win32") {
      socketPath = `\\\\.\\pipe\\rpc-bridge-endurance-${process.pid}-${Date.now()}`;
    } else {
      tmpDir = await mkdtemp(join(tmpdir(), "rpc-bridge-endurance-"));
      socketPath = join(tmpDir!, "sock");
    }
  });

  afterAll(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  // ── E-BRIDGE-UNAVAIL: Daemon unavailability ──────────────────────────────

  it(`E-BRIDGE-UNAVAIL: behavior under daemon unavailability — ${DURATION_MS}ms`, async () => {
    const nonexistentPath = process.platform === "win32"
      ? `\\\\.\\pipe\\actant-nonexistent-${process.pid}-${Date.now()}`
      : join(tmpdir(), `actant-nonexistent-${process.pid}.sock`);
    const bridge = new RpcBridge(nonexistentPath);

    let pings = 0;
    let failures = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      const ok = await bridge.ping();
      if (ok) pings++;
      else failures++;
      await sleep(randomInt(5, 30));
    }

    expect(failures).toBeGreaterThan(0);
    expect(pings).toBe(0);

    console.log(`[endurance] E-BRIDGE-UNAVAIL: ${failures} ping failures in ${Date.now() - startTime}ms`);
  });

  // ── E-BRIDGE-TIMEOUT: Timeout under load ─────────────────────────────────

  it(`E-BRIDGE-TIMEOUT: timeout under load — ${DURATION_MS}ms`, async () => {
    const server = createServer((socket) => {
      socket.on("data", () => {
        // Never respond — force timeout
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    const bridge = new RpcBridge(socketPath);
    let timeouts = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      try {
        await bridge.call("daemon.ping", {}, { timeoutMs: 80 });
      } catch (err) {
        timeouts++;
        expect(err).toBeInstanceOf(Error);
      }
      await sleep(randomInt(10, 50));
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(timeouts).toBeGreaterThan(0);
    console.log(`[endurance] E-BRIDGE-TIMEOUT: ${timeouts} timeouts in ${Date.now() - startTime}ms`);
  });

  // ── E-BRIDGE-DEGRADED: Degraded behavior when server closes mid-request ───

  it(`E-BRIDGE-DEGRADED: server closes mid-request — ${DURATION_MS}ms`, async () => {
    let closeCount = 0;
    const server = createServer((socket) => {
      socket.once("data", () => {
        closeCount++;
        if (closeCount % 2 === 0) {
          socket.destroy();
          return;
        }
        socket.write(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } }) + "\n");
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    const bridge = new RpcBridge(socketPath);
    let ok = 0;
    let errors = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      try {
        await bridge.call("daemon.ping");
        ok++;
      } catch {
        errors++;
      }
      await sleep(randomInt(20, 80));
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(ok + errors).toBeGreaterThan(0);
    console.log(`[endurance] E-BRIDGE-DEGRADED: ${ok} ok, ${errors} errors in ${Date.now() - startTime}ms`);
  });
});
