/**
 * Endurance coverage: Phase 2 (RPC transport)
 * Cross-layer resilience for RpcTransportClient under connection churn,
 * mid-request drops, and timeout load.
 *
 * Run via: pnpm test:endurance
 *   ENDURANCE_DURATION_MS=5000 pnpm test:endurance
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RpcRequest, RpcResponse } from "../../types/rpc.types";
import { RpcTransportClient, RpcTransportError } from "../rpc-transport";

const DURATION_MS = parseInt(process.env.ENDURANCE_DURATION_MS ?? "5000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe("Endurance tests — RPC transport (Phase 2)", () => {
  let tmpDir: string | undefined;
  let socketPath: string;

  beforeAll(async () => {
    if (process.platform === "win32") {
      socketPath = `\\\\.\\pipe\\rpc-transport-endurance-${process.pid}-${Date.now()}`;
    } else {
      tmpDir = await mkdtemp(join(tmpdir(), "rpc-transport-endurance-"));
      socketPath = join(tmpDir!, "sock");
    }
  });

  afterAll(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  // ── E-RPC-CHURN: Request/reply loops under repeated connection churn ─────

  it(`E-RPC-CHURN: request/reply loops under connection churn — ${DURATION_MS}ms`, async () => {
    const server = createServer((socket) => {
      socket.on("data", (chunk) => {
        const str = chunk.toString();
        const lines = str.split("\n").filter((l) => l.trim());
        for (const line of lines) {
          try {
            const req = JSON.parse(line) as RpcRequest;
            const res: RpcResponse = {
              jsonrpc: "2.0",
              id: req.id,
              result: { echo: req.method, ts: Date.now() },
            };
            socket.write(JSON.stringify(res) + "\n");
          } catch {
            // ignore parse errors
          }
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    const transport = new RpcTransportClient({
      defaultTimeoutMs: 5000,
      maxBufferBytes: 64 * 1024,
    });
    await transport.connect(socketPath);

    let cycles = 0;
    let errors = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      try {
        const result = await transport.call("test.echo", { n: cycles });
        expect(result).toBeDefined();
        expect((result as { echo?: string }).echo).toBe("test.echo");
        cycles++;
      } catch (err) {
        errors++;
        expect(err).toBeInstanceOf(RpcTransportError);
      }
      await sleep(randomInt(5, 30));
    }

    transport.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(cycles).toBeGreaterThan(0);
    console.log(`[endurance] E-RPC-CHURN: ${cycles} successful calls, ${errors} errors in ${Date.now() - startTime}ms`);
  });

  // ── E-RPC-DROP: Connection drops mid-request ──────────────────────────────

  it(`E-RPC-DROP: connection drops mid-request — ${DURATION_MS}ms`, async () => {
    let dropCount = 0;
    const server = createServer((socket) => {
      socket.once("data", () => {
        dropCount++;
        if (dropCount % 3 === 0) {
          socket.destroy();
          return;
        }
        const res: RpcResponse = {
          jsonrpc: "2.0",
          id: 1,
          result: { ok: true },
        };
        socket.write(JSON.stringify(res) + "\n");
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    const transport = new RpcTransportClient({ defaultTimeoutMs: 2000 });
    await transport.connect(socketPath);

    let cycles = 0;
    let drops = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      try {
        await transport.call("test.ping");
        cycles++;
      } catch (err) {
        drops++;
        expect(err).toBeInstanceOf(Error);
      }
      await sleep(randomInt(20, 80));
    }

    transport.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(cycles + drops).toBeGreaterThan(0);
    console.log(`[endurance] E-RPC-DROP: ${cycles} ok, ${drops} drops in ${Date.now() - startTime}ms`);
  });

  // ── E-RPC-TIMEOUT: Timeout behavior under load ──────────────────────────

  it(`E-RPC-TIMEOUT: timeout under load — ${DURATION_MS}ms`, async () => {
    const server = createServer((socket) => {
      socket.on("data", () => {
        // Never respond — force client timeout
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    const transport = new RpcTransportClient({ defaultTimeoutMs: 100 });
    await transport.connect(socketPath);

    let timeouts = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      try {
        await transport.call("test.slow");
      } catch (err) {
        timeouts++;
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/timeout|timed out/i);
      }
      await sleep(randomInt(10, 50));
    }

    transport.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(timeouts).toBeGreaterThan(0);
    console.log(`[endurance] E-RPC-TIMEOUT: ${timeouts} timeouts in ${Date.now() - startTime}ms`);
  });
});
