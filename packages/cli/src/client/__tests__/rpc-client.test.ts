import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RpcRequest, RpcResponse } from "@actant/shared";
import { RpcClient, RpcCallError, ConnectionError } from "../rpc-client";

describe("RpcCallError", () => {
  it("has correct name, code, message, data properties", () => {
    const err = new RpcCallError("test message", -32603, { foo: "bar" });
    expect(err.name).toBe("RpcCallError");
    expect(err.code).toBe(-32603);
    expect(err.message).toBe("test message");
    expect(err.data).toEqual({ foo: "bar" });
  });
});

describe("ConnectionError", () => {
  it("has correct name, socketPath, cause properties", () => {
    const cause = new Error("ECONNREFUSED");
    const err = new ConnectionError("/tmp/sock", cause);
    expect(err.name).toBe("ConnectionError");
    expect(err.socketPath).toBe("/tmp/sock");
    expect(err.cause).toBe(cause);
    expect(err.message).toContain("Cannot connect to daemon");
  });
});

describe("RpcClient", () => {
  let tmpDir: string | undefined;
  let socketPath: string;
  let server: Server;

  beforeAll(async () => {
    if (process.platform === "win32") {
      socketPath = `\\\\.\\pipe\\rpc-client-test-${process.pid}-${Date.now()}`;
    } else {
      tmpDir = await mkdtemp(join(tmpdir(), "rpc-client-test-"));
      socketPath = join(tmpDir, "sock");
    }

    server = createServer((socket) => {
      let buffer = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const req = JSON.parse(trimmed) as RpcRequest;
            let response: RpcResponse;
            if (req.method === "template.list") {
              response = {
                jsonrpc: "2.0",
                id: req.id,
                error: { code: -32603, message: "test error", data: { foo: "bar" } },
              };
            } else {
              response = {
                jsonrpc: "2.0",
                id: req.id,
                result: { version: "0.1.0", uptime: 0, agents: 0 },
              };
            }
            socket.write(JSON.stringify(response) + "\n");
            socket.end();
            return;
          } catch {
            /* partial */
          }
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.on("error", reject);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("call() sends request and receives successful response", async () => {
    const client = new RpcClient(socketPath);
    const result = await client.call("daemon.ping", {});
    expect(result).toEqual({ version: "0.1.0", uptime: 0, agents: 0 });
  });

  it("call() throws RpcCallError when response has error", async () => {
    const client = new RpcClient(socketPath);
    const err = await client.call("template.list", {}).catch((e) => e);
    expect(err).toBeInstanceOf(RpcCallError);
    expect(err.name).toBe("RpcCallError");
    expect(err.code).toBe(-32603);
    expect(err.message).toBe("test error");
    expect(err.data).toEqual({ foo: "bar" });
  });

  it("ping() returns true when daemon is running", async () => {
    const client = new RpcClient(socketPath);
    expect(await client.ping()).toBe(true);
  });

  it("ping() returns false when connection fails", async () => {
    const badPath = process.platform === "win32"
      ? `\\\\.\\pipe\\nonexistent-${Date.now()}`
      : `/tmp/nonexistent-${Date.now()}.sock`;
    const client = new RpcClient(badPath);
    expect(await client.ping()).toBe(false);
  });
});
