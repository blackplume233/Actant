import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerBackend, _resetRegistry } from "./backend-registry";
import { registerBuiltinBackends } from "./builtin-backends";
import {
  resolveBackend,
  resolveAcpBackend,
  isAcpBackend,
  isAcpOnlyBackend,
} from "./backend-resolver";

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
    expect(() => resolveBackend("custom", "/workspace")).toThrow(
      'Backend "custom" has no resolveCommand configured.',
    );
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

  it("should throw for pi when not registered in core", () => {
    expect(() => resolveBackend("pi", "/workspace")).toThrow(/not registered/);
  });
});

describe("Pi backend (when registered)", () => {
  const PI_DESCRIPTOR: import("@actant/shared").BackendDescriptor = {
    type: "pi",
    supportedModes: ["acp"],
    acpCommand: { win32: "pi-acp-bridge.cmd", default: "pi-acp-bridge" },
    acpOwnsProcess: true,
  };

  beforeEach(() => {
    registerBackend(PI_DESCRIPTOR);
  });

  afterEach(() => {
    _resetRegistry();
    registerBuiltinBackends();
  });

  it("resolveBackend throws because Pi does not support resolve mode", () => {
    expect(() => resolveBackend("pi", "/workspace")).toThrow(/does not support .*resolve.* mode/);
  });

  it("resolveAcpBackend resolves pi to pi-acp-bridge with no args", () => {
    const result = resolveAcpBackend("pi", "/workspace");
    expect(result.command).toMatch(/pi-acp-bridge/);
    expect(result.args).toEqual([]);
  });

  it("resolveAcpBackend uses executablePath override for pi", () => {
    const result = resolveAcpBackend("pi", "/workspace", { executablePath: "/custom/pi-bridge" });
    expect(result.command).toBe("/custom/pi-bridge");
    expect(result.args).toEqual([]);
  });

  it("isAcpBackend returns true for pi", () => {
    expect(isAcpBackend("pi")).toBe(true);
  });

  it("isAcpOnlyBackend returns true for pi", () => {
    expect(isAcpOnlyBackend("pi")).toBe(true);
  });
});

describe("isAcpBackend", () => {
  it("should return true for claude-code", () => {
    expect(isAcpBackend("claude-code")).toBe(true);
  });

  it("should return true for cursor-agent", () => {
    expect(isAcpBackend("cursor-agent")).toBe(true);
  });

  it("should return false for cursor", () => {
    expect(isAcpBackend("cursor")).toBe(false);
  });

  it("should return false for custom", () => {
    expect(isAcpBackend("custom")).toBe(false);
  });

  it("should return false for pi when not registered", () => {
    expect(isAcpBackend("pi")).toBe(false);
  });
});

describe("isAcpOnlyBackend", () => {
  it("should return false for claude-code", () => {
    expect(isAcpOnlyBackend("claude-code")).toBe(false);
  });

  it("should return false for cursor", () => {
    expect(isAcpOnlyBackend("cursor")).toBe(false);
  });
});
