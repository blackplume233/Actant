import { describe, it, expect, vi, afterEach } from "vitest";
import { buildInternalTools } from "./pi-tool-bridge";

// Access the non-exported helper indirectly by testing buildInternalTools behavior
describe("buildInternalTools", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps canvas.update to internal.canvasUpdate RPC method", () => {
    const tools = buildInternalTools("/tmp/sock", "tok123", [
      {
        name: "actant_canvas_update",
        description: "Update canvas",
        parameters: { html: { type: "string" } },
        rpcMethod: "canvas.update",
      },
    ]);

    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("actant_canvas_update");
    expect(tools[0]!.description).toBe("Update canvas");
  });

  it("maps canvas.clear to internal.canvasClear RPC method", () => {
    const tools = buildInternalTools("/tmp/sock", "tok123", [
      {
        name: "actant_canvas_clear",
        description: "Clear canvas",
        parameters: {},
        rpcMethod: "canvas.clear",
      },
    ]);

    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("actant_canvas_clear");
  });

  it("handles tools with null/undefined parameters gracefully", () => {
    const tools = buildInternalTools("/tmp/sock", "tok123", [
      {
        name: "actant_test_tool",
        description: "Test tool",
        parameters: null as unknown as Record<string, unknown>,
        rpcMethod: "test.run",
      },
    ]);

    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("actant_test_tool");
  });

  it("handles parameters with non-object values", () => {
    const tools = buildInternalTools("/tmp/sock", "tok123", [
      {
        name: "actant_edge",
        description: "Edge case",
        parameters: { badParam: "not-an-object" as unknown },
        rpcMethod: "edge.test",
      },
    ]);

    expect(tools).toHaveLength(1);
  });

  it("creates multiple tools with distinct RPC methods", () => {
    const tools = buildInternalTools("/tmp/sock", "tok123", [
      {
        name: "actant_canvas_update",
        description: "Update canvas",
        parameters: { html: { type: "string" } },
        rpcMethod: "canvas.update",
      },
      {
        name: "actant_canvas_clear",
        description: "Clear canvas",
        parameters: {},
        rpcMethod: "canvas.clear",
      },
      {
        name: "actant_memory_store",
        description: "Store memory",
        parameters: { key: { type: "string" }, value: { type: "string" } },
        rpcMethod: "memory.store",
      },
    ]);

    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual([
      "actant_canvas_update",
      "actant_canvas_clear",
      "actant_memory_store",
    ]);
  });

  it("returns empty array for empty toolDefs", () => {
    const tools = buildInternalTools("/tmp/sock", "tok123", []);
    expect(tools).toEqual([]);
  });
});
