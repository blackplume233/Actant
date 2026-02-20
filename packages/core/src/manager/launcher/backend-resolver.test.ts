import { describe, it, expect } from "vitest";
import { resolveBackend } from "./backend-resolver";

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

  it("should build correct args for claude-code backend", () => {
    const result = resolveBackend("claude-code", "/workspace", { executablePath: "/usr/bin/claude" });
    expect(result.command).toBe("/usr/bin/claude");
    expect(result.args).toEqual(["--project-dir", "/workspace"]);
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
