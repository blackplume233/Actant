import { describe, it, expect, vi } from "vitest";
import { getBackendManager } from "./backend-registry";
import * as backendRegistry from "./backend-registry";
import {
  resolveBackend,
  resolveAcpBackend,
  openBackend,
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

  it("should resolve pi to pi-acp-bridge with no args", () => {
    const result = resolveBackend("pi", "/workspace");
    expect(result.command).toMatch(/pi-acp-bridge/);
    expect(result.args).toEqual([]);
    expect(result.resolvePackage).toBe("@actant/pi");
  });

  it("should use executablePath override for pi", () => {
    const result = resolveBackend("pi", "/workspace", { executablePath: "/custom/bridge" });
    expect(result.command).toBe("/custom/bridge");
    expect(result.args).toEqual([]);
  });

  it("should use custom args override for pi", () => {
    const result = resolveBackend("pi", "/workspace", {
      executablePath: "node",
      args: ["-e", "setTimeout(()=>{},60000)"],
    });
    expect(result.command).toBe("node");
    expect(result.args).toEqual(["-e", "setTimeout(()=>{},60000)"]);
  });

  it("should prefer runtime acpResolver over static resolveCommand (binary distribution)", () => {
    const spy = vi.spyOn(backendRegistry, "getAcpResolver").mockReturnValue(
      () => ({ command: "/usr/local/bin/actant", args: ["--pi-bridge"] }),
    );
    const result = resolveBackend("pi", "/workspace");
    expect(result.command).toBe("/usr/local/bin/actant");
    expect(result.args).toEqual(["--pi-bridge"]);
    spy.mockRestore();
  });

  it("should still prefer executablePath over acpResolver", () => {
    const spy = vi.spyOn(backendRegistry, "getAcpResolver").mockReturnValue(
      () => ({ command: "/usr/local/bin/actant", args: ["--pi-bridge"] }),
    );
    const result = resolveBackend("pi", "/workspace", { executablePath: "/override/bridge" });
    expect(result.command).toBe("/override/bridge");
    expect(result.args).toEqual([]);
    spy.mockRestore();
  });
});

describe("claude-code backend modes", () => {
  it("resolveAcpBackend resolves to claude-agent-acp with no args", () => {
    const result = resolveAcpBackend("claude-code", "/workspace");
    expect(result.command).toMatch(/claude-agent-acp/);
    expect(result.args).toEqual([]);
  });

  it("openBackend resolves to claude with declarative TUI spawn options", () => {
    const result = openBackend("claude-code", "/workspace");
    expect(result.command).toMatch(/^claude(\.exe)?$/);
    expect(result.args).toEqual([]);
    expect(result.cwd).toBe("/workspace");
    expect(result.openSpawnOptions).toEqual({
      stdio: "inherit",
      detached: false,
      windowsHide: false,
      shell: false,
    });
  });
});

describe("Pi backend (builtin)", () => {
  it("resolveBackend resolves pi to pi-acp-bridge", () => {
    const result = resolveBackend("pi", "/workspace");
    expect(result.command).toMatch(/pi-acp-bridge/);
    expect(result.args).toEqual([]);
  });

  it("resolveAcpBackend resolves pi via resolveCommand fallback", () => {
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

  it("isAcpOnlyBackend returns false for pi without acpOwnsProcess", () => {
    expect(isAcpOnlyBackend("pi")).toBe(false);
  });

  it("isAcpOnlyBackend returns true when app-context sets acpOwnsProcess", () => {
    const mgr = getBackendManager();
    const existing = mgr.get("pi")!;
    mgr.register({ ...existing, acpOwnsProcess: true });
    expect(isAcpOnlyBackend("pi")).toBe(true);
    mgr.register({ ...existing, acpOwnsProcess: undefined });
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

  it("should return true for custom", () => {
    expect(isAcpBackend("custom")).toBe(true);
  });

  it("should return true for pi (builtin)", () => {
    expect(isAcpBackend("pi")).toBe(true);
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
