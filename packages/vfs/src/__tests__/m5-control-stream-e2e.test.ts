import { describe, expect, it } from "vitest";
import type { AgentInstanceMeta, VfsStreamChunk, VfsWriteResult } from "@actant/shared";
import { VfsKernel } from "../core/vfs-kernel";
import {
  createAgentRuntimeSource,
  type AgentControlRequest,
  type AgentRuntimeSourceProvider,
} from "@actant/mountfs-runtime-agents";
import {
  createMcpRuntimeSource,
  type McpRuntimeSourceProvider,
} from "@actant/mountfs-runtime-mcp";

function createAgentMeta(name: string): AgentInstanceMeta {
  return {
    id: `${name}-id`,
    name,
    templateName: "test-template",
    templateVersion: "1.0.0",
    backendType: "claude-code",
    interactionModes: ["run"],
    status: "running",
    launchMode: "direct",
    workspacePolicy: "persistent",
    processOwnership: "managed",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    archetype: "repo",
    autoStart: false,
  };
}

async function collectStream(iterable: AsyncIterable<VfsStreamChunk>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk.content);
  }
  return chunks;
}

describe("M5 control + stream execution model", () => {
  it("writes to control/request.json to trigger agent execution and consumes stable stdout", async () => {
    const calls: AgentControlRequest[] = [];
    const provider: AgentRuntimeSourceProvider = {
      kind: "data-source",
      filesystemType: "runtimefs",
      mountPoint: "/agents",
      listRecords: () => [createAgentMeta("worker")],
      getRecord: (name: string) => (name === "worker" ? createAgentMeta(name) : undefined),
      writeControl: async (_name: string, _controlPath: "request.json", content: string): Promise<VfsWriteResult> => {
        calls.push(JSON.parse(content) as AgentControlRequest);
        return { bytesWritten: Buffer.byteLength(content), created: false };
      },
      stream: async function* (_name: string, stream: "stdout" | "stderr") {
        expect(stream).toBe("stdout");
        yield { content: "booting\n", timestamp: 1 };
        yield { content: "done\n", timestamp: 2 };
      },
    };

    const kernel = new VfsKernel();
    kernel.mount(createAgentRuntimeSource(provider, "/agents", { type: "manual" }));

    await kernel.write(
      "/agents/worker/control/request.json",
      JSON.stringify({ prompt: "run diagnostics", sessionId: "session-1" }),
    );

    const chunks = await collectStream(await kernel.stream("/agents/worker/streams/stdout"));
    expect(calls).toEqual([
      {
        prompt: "run diagnostics",
        sessionId: "session-1",
      },
    ]);
    expect(chunks).toEqual(["booting\n", "done\n"]);
  });

  it("provides a stable synthetic MCP runtime events stream without a separate execution system", async () => {
    const provider: McpRuntimeSourceProvider = {
      kind: "data-source",
      filesystemType: "runtimefs",
      mountPoint: "/mcp/runtime",
      listRecords: () => [
        {
          name: "local-runtime",
          status: "inactive",
          command: "npx",
          args: ["@modelcontextprotocol/server"],
          transport: "stdio",
        },
      ],
      getRecord: (name: string) => (
        name === "local-runtime"
          ? {
            name,
            status: "inactive",
            command: "npx",
            args: ["@modelcontextprotocol/server"],
            transport: "stdio",
          }
          : undefined
      ),
    };

    const kernel = new VfsKernel();
    kernel.mount(createMcpRuntimeSource(provider, "/mcp/runtime", { type: "manual" }));

    const chunks = await collectStream(await kernel.stream("/mcp/runtime/local-runtime/streams/events"));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("\"type\": \"snapshot\"");
    expect(chunks[0]).toContain("\"local-runtime\"");
  });

  it("uses explicit error semantics for invalid control requests and missing streams", async () => {
    const provider: AgentRuntimeSourceProvider = {
      kind: "data-source",
      filesystemType: "runtimefs",
      mountPoint: "/agents",
      listRecords: () => [createAgentMeta("worker")],
      getRecord: (name: string) => (name === "worker" ? createAgentMeta(name) : undefined),
      writeControl: async () => ({ bytesWritten: 0, created: false }),
    };

    const kernel = new VfsKernel();
    kernel.mount(createAgentRuntimeSource(provider, "/agents", { type: "manual" }));

    await expect(
      kernel.write("/agents/worker/control/request.json", JSON.stringify({ prompt: "" })),
    ).rejects.toThrow('Invalid control request for agent "worker": "prompt" must be a non-empty string');

    await expect(
      kernel.stream("/agents/worker/streams/events"),
    ).rejects.toThrow("Stream not found");
  });
});
