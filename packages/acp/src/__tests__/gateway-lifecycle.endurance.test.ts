/**
 * Endurance coverage: Phase 2 (ACP Gateway lifecycle)
 * Reconnect and cleanup scenarios, terminal handle cleanup after upstream
 * disconnect, resource leak detection over N connect/disconnect cycles.
 *
 * Run via: pnpm test:endurance
 *   ENDURANCE_DURATION_MS=5000 pnpm test:endurance
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer, createConnection, type Server } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AcpGateway } from "../gateway";
import { ClientCallbackRouter } from "../callback-router";
import type { ClientCallbackHandler } from "../connection";
import type { AcpConnection } from "../connection";

const DURATION_MS = parseInt(process.env.ENDURANCE_DURATION_MS ?? "5000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createMockLocal(): ClientCallbackHandler {
  return {
    requestPermission: vi.fn().mockResolvedValue({ outcome: { optionId: "allow" } }),
    sessionUpdate: vi.fn().mockResolvedValue(undefined),
    readTextFile: vi.fn().mockResolvedValue({ content: "" }),
    writeTextFile: vi.fn().mockResolvedValue({}),
    createTerminal: vi.fn().mockResolvedValue({ terminalId: "mock-term" }),
    terminalOutput: vi.fn().mockResolvedValue({ output: "", truncated: false }),
    waitForTerminalExit: vi.fn().mockResolvedValue({ exitCode: 0, signal: null }),
    killTerminal: vi.fn().mockResolvedValue({}),
    releaseTerminal: vi.fn().mockResolvedValue({}),
  };
}

function createMockDownstream(): AcpConnection {
  return {
    agentCapabilities: {
      protocolVersion: 1,
      agentCapabilities: {},
      agentInfo: { name: "mock-agent", version: "1.0" },
    },
    rawConnection: null,
    authenticate: vi.fn().mockResolvedValue(undefined),
    newSession: vi.fn().mockResolvedValue({ sessionId: "s1", modes: [], configOptions: [] }),
    loadSession: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    setSessionMode: vi.fn().mockResolvedValue(undefined),
    setSessionConfigOption: vi.fn().mockResolvedValue({}),
  } as unknown as AcpConnection;
}

function getSocketPath(): string {
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\gateway-endurance-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return join(tmpdir(), `gateway-endurance-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.sock`);
}

describe("Endurance tests — ACP Gateway lifecycle (Phase 2)", () => {
  let tmpDir: string | undefined;

  beforeAll(async () => {
    if (process.platform !== "win32") {
      tmpDir = await mkdtemp(join(tmpdir(), "gateway-endurance-"));
    }
  });

  afterAll(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  async function closeServer(srv: Server): Promise<void> {
    await new Promise<void>((resolve) => {
      srv.close(() => resolve());
    });
  }

  // ── E-ACP-RECONNECT: Gateway reconnect and cleanup cycles ─────────────────

  it(`E-ACP-RECONNECT: connect/disconnect cycles — ${DURATION_MS}ms`, async () => {
    const socketPath = getSocketPath();
    const downstream = createMockDownstream();
    const local = createMockLocal();
    const callbackRouter = new ClientCallbackRouter(local);
    const gateway = new AcpGateway({ downstream, callbackRouter });

    const server = createServer((socket) => {
      gateway.acceptSocket(socket);
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    let cycles = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      await new Promise<void>((resolve, reject) => {
        const client = createConnection(socketPath, () => {
          client.end();
        });
        client.on("close", () => resolve());
        client.on("error", reject);
      });
      cycles++;
      await sleep(randomInt(5, 25));
    }

    expect(gateway.isUpstreamConnected).toBe(false);
    gateway.disconnectUpstream();
    await closeServer(server);

    console.log(`[endurance] E-ACP-RECONNECT: ${cycles} connect/disconnect cycles in ${Date.now() - startTime}ms`);
  });

  // ── E-ACP-DISCONNECT: Explicit disconnectUpstream after each connect ────

  it(`E-ACP-DISCONNECT: explicit disconnectUpstream cycles — ${DURATION_MS}ms`, async () => {
    const socketPath = getSocketPath();
    const downstream = createMockDownstream();
    const local = createMockLocal();
    const callbackRouter = new ClientCallbackRouter(local);
    const gateway = new AcpGateway({ downstream, callbackRouter });

    const server = createServer((socket) => {
      gateway.acceptSocket(socket);
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    let cycles = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      await new Promise<void>((resolve, reject) => {
        const client = createConnection(socketPath, () => {
          gateway.disconnectUpstream();
          client.end();
        });
        client.on("close", () => resolve());
        client.on("error", reject);
      });
      cycles++;
      await sleep(randomInt(10, 40));
    }

    expect(gateway.isUpstreamConnected).toBe(false);
    await closeServer(server);

    console.log(`[endurance] E-ACP-DISCONNECT: ${cycles} cycles in ${Date.now() - startTime}ms`);
  });

  // ── E-ACP-LEAK: Verify no resource accumulation after N cycles ──────────

  it(`E-ACP-LEAK: no resource leaks after N cycles — ${DURATION_MS}ms`, async () => {
    const socketPath = getSocketPath();
    const downstream = createMockDownstream();
    const local = createMockLocal();
    const callbackRouter = new ClientCallbackRouter(local);
    const gateway = new AcpGateway({ downstream, callbackRouter });

    const server = createServer((socket) => {
      gateway.acceptSocket(socket);
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    const cycleCount = 50;
    for (let i = 0; i < cycleCount; i++) {
      await new Promise<void>((resolve, reject) => {
        const client = createConnection(socketPath, () => {
          client.end();
        });
        client.on("close", () => resolve());
        client.on("error", reject);
      });
      gateway.disconnectUpstream();
    }

    expect(gateway.isUpstreamConnected).toBe(false);
    expect(callbackRouter.isLeaseActive).toBe(false);
    await closeServer(server);

    console.log(`[endurance] E-ACP-LEAK: ${cycleCount} cycles completed, no leaks detected`);
  });
});
