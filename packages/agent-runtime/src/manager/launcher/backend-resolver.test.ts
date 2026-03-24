import { describe, it, expect, vi } from "vitest";
import type { BackendDefinition } from "@actant/shared/core";
import { createBackendManager, getBackendManager } from "./backend-registry";
import * as backendRegistry from "./backend-registry";
import {
  resolveBackend,
  resolveAcpBackend,
  openBackend,
  isAcpBackend,
  isAcpOnlyBackend,
  validateBackendForArchetype,
  resolveRuntimeContract,
  supportsManagedOperation,
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

  it("resolves against an injected BackendManager without touching the singleton registry", () => {
    const isolatedManager = createBackendManager();
    isolatedManager.register({
      name: "isolated",
      version: "1.0.0",
      description: "isolated backend",
      origin: { type: "builtin" },
      supportedModes: ["resolve"],
      defaultInteractionModes: ["open"],
      runtimeProfile: "openOnly",
      maturity: "stable",
      capabilities: {
        supportsOpen: true,
        supportsManagedSessions: false,
        supportsServiceArchetype: false,
        supportsEmployeeArchetype: false,
        supportsPromptApi: false,
      },
      resolveCommand: { win32: "isolated.cmd", default: "isolated" },
    });

    expect(getBackendManager().get("isolated")).toBeUndefined();

    const result = resolveBackend("isolated" as never, "/workspace", undefined, isolatedManager);
    expect(result.command).toBe("isolated");
    expect(result.args).toEqual(["/workspace"]);
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

// ---------------------------------------------------------------------------
// Capability-Driven Validation Tests (#plan)
// ---------------------------------------------------------------------------

describe("validateBackendForArchetype", () => {
  it("repo + cursor (openOnly) => valid", () => {
    const backend = getBackendManager().get("cursor")!;
    const result = validateBackendForArchetype(backend, "repo");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("repo + claude-code (managedPrimary) => valid", () => {
    const backend = getBackendManager().get("claude-code")!;
    const result = validateBackendForArchetype(backend, "repo");
    expect(result.valid).toBe(true);
  });

  it("service + claude-code (managedPrimary) => valid", () => {
    const backend = getBackendManager().get("claude-code")!;
    const result = validateBackendForArchetype(backend, "service");
    expect(result.valid).toBe(true);
  });

  it("employee + claude-code (managedPrimary) => valid", () => {
    const backend = getBackendManager().get("claude-code")!;
    const result = validateBackendForArchetype(backend, "employee");
    expect(result.valid).toBe(true);
  });

  it("service + cursor (openOnly) => invalid with clear error", () => {
    const backend = getBackendManager().get("cursor")!;
    const result = validateBackendForArchetype(backend, "service");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Open-only");
    expect(result.error).toContain("repo");
    expect(result.error).toContain("claude-code");
  });

  it("employee + cursor (openOnly) => invalid with clear error", () => {
    const backend = getBackendManager().get("cursor")!;
    const result = validateBackendForArchetype(backend, "employee");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Open-only");
  });

  it("service + cursor-agent (openOnly/experimental) => invalid", () => {
    const backend = getBackendManager().get("cursor-agent")!;
    const result = validateBackendForArchetype(backend, "service");
    expect(result.valid).toBe(false);
  });

  it("service + pi (managedExperimental) => valid with warning", () => {
    const backend = getBackendManager().get("pi")!;
    const result = validateBackendForArchetype(backend, "service");
    expect(result.valid).toBe(true);
    expect(result.warning).toContain("experimental");
  });

  it("employee + pi (managedExperimental) => valid with warning", () => {
    const backend = getBackendManager().get("pi")!;
    const result = validateBackendForArchetype(backend, "employee");
    expect(result.valid).toBe(true);
    expect(result.warning).toContain("experimental");
  });

  it("repo + pi (managedExperimental) => invalid (Pi doesn't support repo)", () => {
    const backend = getBackendManager().get("pi")!;
    const result = validateBackendForArchetype(backend, "repo");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("does not support");
  });

  it("custom backend without managed support => invalid for service", () => {
    const backend: BackendDefinition = {
      name: "custom-test",
      version: "1.0.0",
      origin: { type: "builtin" },
      supportedModes: ["resolve", "acp"],
      runtimeProfile: "custom",
      maturity: "stable",
      capabilities: {
        supportsOpen: false,
        supportsManagedSessions: false,
        supportsServiceArchetype: false,
        supportsEmployeeArchetype: false,
        supportsPromptApi: false,
      },
    };
    const result = validateBackendForArchetype(backend, "service");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("does not declare managed session support");
  });

  it("custom backend with managed support => valid for service", () => {
    const backend: BackendDefinition = {
      name: "custom-test",
      version: "1.0.0",
      origin: { type: "builtin" },
      supportedModes: ["resolve", "acp"],
      runtimeProfile: "custom",
      maturity: "stable",
      capabilities: {
        supportsOpen: false,
        supportsManagedSessions: true,
        supportsServiceArchetype: true,
        supportsEmployeeArchetype: false,
        supportsPromptApi: true,
      },
    };
    const result = validateBackendForArchetype(backend, "service");
    expect(result.valid).toBe(true);
  });
});

describe("resolveRuntimeContract", () => {
  it("claude-code + repo => allows open, managed modes", () => {
    const contract = resolveRuntimeContract("claude-code", "repo");
    expect(contract.allowedArchetypes).toContain("repo");
    expect(contract.allowedArchetypes).toContain("service");
    expect(contract.allowedArchetypes).toContain("employee");
    expect(contract.allowedInteractionModes).toContain("open");
    expect(contract.allowedInteractionModes).toContain("start");
    expect(contract.allowedInteractionModes).toContain("chat");
    expect(contract.allowedInteractionModes).toContain("run");
    expect(contract.allowedInteractionModes).toContain("proxy");
    expect(contract.requiresExperimentalFlag).toBe(false);
  });

  it("cursor + repo => allows only open mode", () => {
    const contract = resolveRuntimeContract("cursor", "repo");
    expect(contract.allowedArchetypes).toContain("repo");
    expect(contract.allowedArchetypes).not.toContain("service");
    expect(contract.allowedArchetypes).not.toContain("employee");
    expect(contract.allowedInteractionModes).toContain("open");
    expect(contract.allowedInteractionModes).not.toContain("start");
  });

  it("throws for invalid combinations (service + cursor)", () => {
    expect(() => resolveRuntimeContract("cursor", "service")).toThrow("Open-only");
  });

  it("pi + service => marks as experimental", () => {
    const contract = resolveRuntimeContract("pi", "service");
    expect(contract.requiresExperimentalFlag).toBe(true);
    expect(contract.warnings.length).toBeGreaterThan(0);
  });
});

describe("supportsManagedOperation", () => {
  it("claude-code supports all managed operations", () => {
    expect(supportsManagedOperation("claude-code", "start")).toBe(true);
    expect(supportsManagedOperation("claude-code", "prompt")).toBe(true);
    expect(supportsManagedOperation("claude-code", "run")).toBe(true);
    expect(supportsManagedOperation("claude-code", "session")).toBe(true);
  });

  it("pi supports all managed operations (experimental)", () => {
    expect(supportsManagedOperation("pi", "start")).toBe(true);
    expect(supportsManagedOperation("pi", "prompt")).toBe(true);
    expect(supportsManagedOperation("pi", "run")).toBe(true);
  });

  it("cursor does not support managed operations", () => {
    expect(supportsManagedOperation("cursor", "start")).toBe(false);
    expect(supportsManagedOperation("cursor", "prompt")).toBe(false);
    expect(supportsManagedOperation("cursor", "run")).toBe(false);
  });

  it("cursor-agent does not support managed operations", () => {
    expect(supportsManagedOperation("cursor-agent", "start")).toBe(false);
  });

  it("custom backend defaults to false", () => {
    expect(supportsManagedOperation("custom", "start")).toBe(false);
  });
});
