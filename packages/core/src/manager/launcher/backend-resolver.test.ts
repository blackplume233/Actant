import { describe, it, expect } from "vitest";
import { resolveBackend, isAcpBackend } from "./backend-resolver";

describe("resolveBackend", () => {
  it("should use executablePath from backendConfig when provided", () => {
    const result = resolveBackend("cursor", "/workspace", { executablePath: "/custom/cursor" });
    expect(result.command).toBe("/custom/cursor");
    expect(result.args).toEqual(["/workspace"]);
  });

  it("should use default command when no executablePath provided", () => {
    const result = resolveBackend("cursor", "/workspace");
    expect(result.command).toBeTruthy();
    expect(result.args).toEqual(["/workspace"]);
  });

  it("should resolve claude-code to claude-agent-acp with no args", () => {
    const result = resolveBackend("claude-code", "/workspace");
    expect(result.command).toMatch(/claude-agent-acp/);
    expect(result.args).toEqual([]);
  });

  it("should use executablePath override for claude-code", () => {
    const result = resolveBackend("claude-code", "/workspace", { executablePath: "/custom/acp" });
    expect(result.command).toBe("/custom/acp");
    expect(result.args).toEqual([]);
  });

  it("should throw for custom backend without executablePath", () => {
    expect(() => resolveBackend("custom", "/workspace")).toThrow("Custom backend requires explicit executablePath");
  });

  it("should work for custom backend with executablePath", () => {
    const result = resolveBackend("custom", "/workspace", { executablePath: "/my/agent" });
    expect(result.command).toBe("/my/agent");
    expect(result.args).toEqual(["/workspace"]);
  });

  it("should use custom args from backendConfig when provided", () => {
    const result = resolveBackend("custom", "/workspace", {
      executablePath: "node",
      args: ["-e", "console.log('hello')"],
    });
    expect(result.command).toBe("node");
    expect(result.args).toEqual(["-e", "console.log('hello')"]);
  });
});

describe("isAcpBackend", () => {
  it("should return true for claude-code", () => {
    expect(isAcpBackend("claude-code")).toBe(true);
  });

  it("should return false for cursor", () => {
    expect(isAcpBackend("cursor")).toBe(false);
  });

  it("should return false for custom", () => {
    expect(isAcpBackend("custom")).toBe(false);
  });
});
