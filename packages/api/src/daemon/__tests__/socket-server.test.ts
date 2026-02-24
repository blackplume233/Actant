import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createConnection, type Socket } from "node:net";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RpcRequest, RpcResponse } from "@actant/shared";
import { RPC_ERROR_CODES, getIpcPath } from "@actant/shared";
import { AppContext } from "../../services/app-context";
import { SocketServer } from "../socket-server";
import {
  HandlerRegistry,
  registerTemplateHandlers,
  registerAgentHandlers,
  registerDaemonHandlers,
} from "../../handlers/index";

function rpcCall(socketPath: string, request: RpcRequest): Promise<RpcResponse> {
  return new Promise((resolve, reject) => {
    const client: Socket = createConnection(socketPath, () => {
      client.write(JSON.stringify(request) + "\n");
    });

    let buffer = "";
    client.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const response = JSON.parse(trimmed) as RpcResponse;
          client.end();
          resolve(response);
        } catch {
          // partial data, continue
        }
      }
    });

    client.on("error", reject);
    client.setTimeout(5000, () => {
      client.destroy();
      reject(new Error("Timeout"));
    });
  });
}

describe("SocketServer integration", () => {
  let tmpDir: string;
  let socketPath: string;
  let ctx: AppContext;
  let server: SocketServer;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ac-socket-test-"));
    socketPath = getIpcPath(tmpDir);
    ctx = new AppContext({ homeDir: tmpDir, launcherMode: "mock" });
    await ctx.init();

    const handlers = new HandlerRegistry();
    registerTemplateHandlers(handlers);
    registerAgentHandlers(handlers);
    registerDaemonHandlers(handlers, async () => {});

    server = new SocketServer(handlers, ctx);
    await server.listen(socketPath);
  });

  afterAll(async () => {
    await server.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("responds to a valid RPC request", async () => {
    const res = await rpcCall(socketPath, {
      jsonrpc: "2.0",
      id: 1,
      method: "template.list",
    });

    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(1);
    expect(res.result).toEqual([]);
    expect(res.error).toBeUndefined();
  });

  it("returns METHOD_NOT_FOUND for unknown method", async () => {
    const res = await rpcCall(socketPath, {
      jsonrpc: "2.0",
      id: 2,
      method: "unknown.method",
    });

    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe(RPC_ERROR_CODES.METHOD_NOT_FOUND);
  });

  it("returns PARSE_ERROR for invalid JSON", async () => {
    const res = await new Promise<RpcResponse>((resolve, reject) => {
      const client = createConnection(socketPath, () => {
        client.write("not json at all\n");
      });
      let buffer = "";
      client.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            client.end();
            resolve(JSON.parse(trimmed) as RpcResponse);
          } catch { /* continue */ }
        }
      });
      client.on("error", reject);
    });

    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe(RPC_ERROR_CODES.PARSE_ERROR);
  });

  it("returns INVALID_REQUEST for malformed request", async () => {
    const res = await rpcCall(socketPath, {
      jsonrpc: "1.0",
      id: 3,
      method: "template.list",
    } as unknown as RpcRequest);

    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe(RPC_ERROR_CODES.INVALID_REQUEST);
  });

  it("returns business error with correct code for TemplateNotFoundError", async () => {
    const res = await rpcCall(socketPath, {
      jsonrpc: "2.0",
      id: 4,
      method: "template.get",
      params: { name: "nonexistent" },
    });

    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe(RPC_ERROR_CODES.TEMPLATE_NOT_FOUND);
    expect(res.error?.message).toContain("not found");
  });

  it("handles full agent lifecycle over RPC", async () => {
    const tplFile = join(tmpDir, "rpc-tpl.json");
    await writeFile(tplFile, JSON.stringify({
      name: "rpc-tpl",
      version: "1.0.0",
      backend: { type: "claude-code" },
      provider: { type: "anthropic" },
      domainContext: {},
    }));

    const loadRes = await rpcCall(socketPath, {
      jsonrpc: "2.0", id: 10, method: "template.load",
      params: { filePath: tplFile },
    });
    expect(loadRes.result).toBeDefined();

    const createRes = await rpcCall(socketPath, {
      jsonrpc: "2.0", id: 11, method: "agent.create",
      params: { name: "rpc-agent", template: "rpc-tpl" },
    });
    expect((createRes.result as { status: string }).status).toBe("created");

    const startRes = await rpcCall(socketPath, {
      jsonrpc: "2.0", id: 12, method: "agent.start",
      params: { name: "rpc-agent" },
    });
    expect((startRes.result as { status: string }).status).toBe("running");

    const listRes = await rpcCall(socketPath, {
      jsonrpc: "2.0", id: 13, method: "agent.list",
    });
    expect(listRes.result).toHaveLength(1);

    const stopRes = await rpcCall(socketPath, {
      jsonrpc: "2.0", id: 14, method: "agent.stop",
      params: { name: "rpc-agent" },
    });
    expect((stopRes.result as { status: string }).status).toBe("stopped");

    const destroyRes = await rpcCall(socketPath, {
      jsonrpc: "2.0", id: 15, method: "agent.destroy",
      params: { name: "rpc-agent" },
    });
    expect((destroyRes.result as { success: boolean }).success).toBe(true);
  });

  it("daemon.ping returns version and uptime", async () => {
    const res = await rpcCall(socketPath, {
      jsonrpc: "2.0", id: 20, method: "daemon.ping",
    });
    const result = res.result as { version: string; uptime: number; agents: number };
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof result.agents).toBe("number");
  });
});
