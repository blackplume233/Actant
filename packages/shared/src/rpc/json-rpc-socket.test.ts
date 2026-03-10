import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RpcRequest, RpcResponse } from "../types/rpc.types";
import { sendJsonRpcRequest } from "./json-rpc-socket";

describe("sendJsonRpcRequest", () => {
  let tmpDir: string | undefined;
  let socketPath: string;
  let server: Server;

  beforeAll(async () => {
    if (process.platform === "win32") {
      socketPath = `\\\\.\\pipe\\json-rpc-socket-test-${process.pid}-${Date.now()}`;
    } else {
      tmpDir = await mkdtemp(join(tmpdir(), "json-rpc-socket-test-"));
      socketPath = join(tmpDir, "sock");
    }
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    }).catch(() => {});
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns parsed JSON-RPC response", async () => {
    server = createServer((socket) => {
      socket.once("data", () => {
        const response: RpcResponse = {
          jsonrpc: "2.0",
          id: 1,
          result: { ok: true },
        };
        socket.write(JSON.stringify(response) + "\n");
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    const request: RpcRequest = { jsonrpc: "2.0", id: 1, method: "daemon.ping", params: {} };
    const result = await sendJsonRpcRequest(socketPath, request);
    expect(result.result).toEqual({ ok: true });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("supports partial response chunks", async () => {
    server = createServer((socket) => {
      socket.once("data", () => {
        socket.write('{"jsonrpc":"2.0","id":1,');
        socket.write('"result":{"ok":true}}\n');
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    const request: RpcRequest = { jsonrpc: "2.0", id: 1, method: "daemon.ping", params: {} };
    const result = await sendJsonRpcRequest(socketPath, request);
    expect(result.result).toEqual({ ok: true });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("fails on buffer overflow", async () => {
    server = createServer((socket) => {
      socket.once("data", () => {
        socket.write("x".repeat(200));
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, () => resolve());
      server.once("error", reject);
    });

    const request: RpcRequest = { jsonrpc: "2.0", id: 1, method: "daemon.ping", params: {} };
    await expect(sendJsonRpcRequest(socketPath, request, { maxBufferBytes: 64 })).rejects.toThrow("buffer limit");
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
