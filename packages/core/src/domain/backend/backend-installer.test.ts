import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import {
  detectJsPackageManager,
  detectSystemManagers,
  executeInstall,
  tryInstallMethods,
  ensureResolvePackage,
  _resetDetectionCache,
} from "./backend-installer";
import type { BackendInstallMethod } from "@actant/shared";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);

function mockCommandExists(availableCommands: string[]) {
  mockExecFile.mockImplementation(((
    cmd: string,
    args: string[],
    _opts: unknown,
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    const probeCmd = args[0];
    if ((cmd === "which" || cmd === "where") && probeCmd) {
      if (availableCommands.includes(probeCmd)) {
        cb(null, `/usr/bin/${probeCmd}`, "");
      } else {
        cb(new Error("not found"), "", "");
      }
      return;
    }

    if (cmd === "npm" || cmd === "pnpm" || cmd === "yarn" || cmd === "bun") {
      if (args[0] === "install" || args[0] === "add" || args[0] === "global") {
        cb(null, "installed", "");
        return;
      }
    }

    if (cmd === "brew" || cmd === "winget" || cmd === "choco") {
      if (args[0] === "install") {
        cb(null, "installed", "");
        return;
      }
    }

    cb(new Error(`Unknown command: ${cmd}`), "", "");
  }) as unknown as typeof execFile);
}

function mockCommandExistsWithFailedInstall(availableCommands: string[]) {
  mockExecFile.mockImplementation(((
    cmd: string,
    args: string[],
    _opts: unknown,
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    if (cmd === "which" || cmd === "where") {
      const probeCmd = args[0];
      if (probeCmd && availableCommands.includes(probeCmd)) {
        cb(null, `/usr/bin/${probeCmd}`, "");
      } else {
        cb(new Error("not found"), "", "");
      }
      return;
    }

    cb(new Error("install failed: permission denied"), "", "permission denied");
  }) as unknown as typeof execFile);
}

describe("backend-installer", () => {
  beforeEach(() => {
    _resetDetectionCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectJsPackageManager", () => {
    it("should detect npm when available", async () => {
      mockCommandExists(["npm"]);
      const mgr = await detectJsPackageManager();
      expect(mgr).toEqual({ type: "npm", command: "npm" });
    });

    it("should fallback to pnpm when npm is not available", async () => {
      mockCommandExists(["pnpm"]);
      const mgr = await detectJsPackageManager();
      expect(mgr).toEqual({ type: "pnpm", command: "pnpm" });
    });

    it("should fallback to yarn when npm and pnpm are not available", async () => {
      mockCommandExists(["yarn"]);
      const mgr = await detectJsPackageManager();
      expect(mgr).toEqual({ type: "yarn", command: "yarn" });
    });

    it("should fallback to bun when no other JS managers are available", async () => {
      mockCommandExists(["bun"]);
      const mgr = await detectJsPackageManager();
      expect(mgr).toEqual({ type: "bun", command: "bun" });
    });

    it("should return null when no JS package manager is available", async () => {
      mockCommandExists([]);
      const mgr = await detectJsPackageManager();
      expect(mgr).toBeNull();
    });

    it("should cache the result", async () => {
      mockCommandExists(["npm"]);
      const first = await detectJsPackageManager();
      const second = await detectJsPackageManager();
      expect(first).toBe(second);
    });
  });

  describe("detectSystemManagers", () => {
    it("should detect available system managers for the platform", async () => {
      const plat = process.platform;
      if (plat === "darwin") {
        mockCommandExists(["brew"]);
        const managers = await detectSystemManagers();
        expect(managers.some((m) => m.type === "brew")).toBe(true);
      } else if (plat === "win32") {
        mockCommandExists(["winget", "choco"]);
        const managers = await detectSystemManagers();
        expect(managers.length).toBeGreaterThan(0);
      } else {
        mockCommandExists([]);
        const managers = await detectSystemManagers();
        expect(managers).toEqual([]);
      }
    });
  });

  describe("executeInstall", () => {
    it("should install via npm when available", async () => {
      mockCommandExists(["npm"]);
      const result = await executeInstall({ type: "npm", package: "@test/pkg" });
      expect(result.installed).toBe(true);
      expect(result.method).toBe("npm");
    });

    it("should fallback to pnpm when npm is not available", async () => {
      mockCommandExists(["pnpm"]);
      const result = await executeInstall({ type: "npm", package: "@test/pkg" });
      expect(result.installed).toBe(true);
      expect(result.method).toBe("pnpm");
    });

    it("should return error when no JS package manager is available for npm type", async () => {
      mockCommandExists([]);
      const result = await executeInstall({ type: "npm", package: "@test/pkg" });
      expect(result.installed).toBe(false);
      expect(result.error).toContain("No JavaScript package manager found");
    });

    it("should return error for npm type without package", async () => {
      mockCommandExists(["npm"]);
      const result = await executeInstall({ type: "npm" });
      expect(result.installed).toBe(false);
      expect(result.error).toContain("No package specified");
    });

    it("should handle install failure gracefully", async () => {
      mockCommandExistsWithFailedInstall(["npm"]);
      const result = await executeInstall({ type: "npm", package: "@test/pkg" });
      expect(result.installed).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should not attempt auto-install for url type", async () => {
      const result = await executeInstall({ type: "url", package: "https://example.com" });
      expect(result.installed).toBe(false);
      expect(result.method).toBe("url");
    });

    it("should not attempt auto-install for manual type", async () => {
      const result = await executeInstall({ type: "manual", instructions: "Install manually" });
      expect(result.installed).toBe(false);
      expect(result.method).toBe("manual");
      expect(result.error).toContain("Install manually");
    });
  });

  describe("tryInstallMethods", () => {
    it("should try methods in order and stop at first success", async () => {
      mockCommandExists(["npm"]);
      const methods: BackendInstallMethod[] = [
        { type: "npm", package: "@test/pkg1" },
        { type: "npm", package: "@test/pkg2" },
      ];
      const result = await tryInstallMethods(methods);
      expect(result.installed).toBe(true);
      expect(result.attempts.length).toBe(1);
    });

    it("should collect manual instructions separately", async () => {
      mockCommandExists([]);
      const methods: BackendInstallMethod[] = [
        { type: "url", package: "https://example.com" },
        { type: "manual", instructions: "See docs" },
      ];
      const result = await tryInstallMethods(methods);
      expect(result.installed).toBe(false);
      expect(result.manualInstructions?.length).toBe(2);
    });

    it("should return empty result for empty methods list", async () => {
      const result = await tryInstallMethods([]);
      expect(result.installed).toBe(false);
      expect(result.manualInstructions).toContain("No install method available for this platform.");
    });

    it("should skip methods not applicable to current platform", async () => {
      mockCommandExists(["npm"]);
      const otherPlatform = process.platform === "win32" ? "darwin" : "win32";
      const methods: BackendInstallMethod[] = [
        { type: "npm", package: "@test/pkg", platforms: [otherPlatform as NodeJS.Platform] },
      ];
      const result = await tryInstallMethods(methods);
      expect(result.installed).toBe(false);
    });
  });

  describe("ensureResolvePackage", () => {
    it("should install a resolve package via detected JS manager", async () => {
      mockCommandExists(["npm"]);
      const result = await ensureResolvePackage("@zed-industries/claude-agent-acp");
      expect(result.installed).toBe(true);
    });

    it("should fail gracefully when no JS manager is available", async () => {
      mockCommandExists([]);
      const result = await ensureResolvePackage("@zed-industries/claude-agent-acp");
      expect(result.installed).toBe(false);
      expect(result.error).toContain("No JavaScript package manager found");
    });
  });
});
