import { describe, it, expect, vi, beforeEach } from "vitest";
import { BackendManager } from "./backend-manager";
import type { BackendDefinition } from "@actant/shared";

vi.mock("./backend-installer", () => ({
  tryInstallMethods: vi.fn(),
  ensureResolvePackage: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { tryInstallMethods, ensureResolvePackage } from "./backend-installer";
import { execFile } from "node:child_process";

const mockTryInstall = vi.mocked(tryInstallMethods);
const mockEnsureResolve = vi.mocked(ensureResolvePackage);
const mockExecFile = vi.mocked(execFile);

const testBackend: BackendDefinition = {
  name: "test-backend",
  version: "1.0.0",
  supportedModes: ["resolve", "acp"],
  resolveCommand: { win32: "test.cmd", default: "test" },
  existenceCheck: { command: "test", args: ["--version"] },
  resolvePackage: "@test/acp-bridge",
  install: [
    { type: "npm", package: "@test/cli", label: "npm install -g @test/cli" },
    { type: "url", package: "https://test.com", label: "Download from test.com" },
  ],
};

function mockExistenceCheckResult(available: boolean, version?: string) {
  mockExecFile.mockImplementation(((
    _cmd: string,
    _args: string[],
    _opts: unknown,
    cb: (err: Error | null, stdout: string) => void,
  ) => {
    if (available) {
      cb(null, version ?? "1.0.0");
    } else {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      cb(err, "");
    }
  }) as unknown as typeof execFile);
}

describe("BackendManager install methods", () => {
  let manager: BackendManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new BackendManager();
    manager.register(testBackend);
  });

  describe("ensureAvailable", () => {
    it("should return available when backend is already installed", async () => {
      mockExistenceCheckResult(true, "2.0.0");
      const result = await manager.ensureAvailable("test-backend");
      expect(result.available).toBe(true);
      expect(result.alreadyInstalled).toBe(true);
      expect(result.version).toBe("2.0.0");
    });

    it("should return install methods when backend is missing and autoInstall is false", async () => {
      mockExistenceCheckResult(false);
      const result = await manager.ensureAvailable("test-backend", { autoInstall: false });
      expect(result.available).toBe(false);
      expect(result.installMethods).toBeDefined();
      expect(result.installMethods!.length).toBeGreaterThan(0);
    });

    it("should return install methods when backend is missing and autoInstall is undefined", async () => {
      mockExistenceCheckResult(false);
      const result = await manager.ensureAvailable("test-backend");
      expect(result.available).toBe(false);
      expect(result.installMethods).toBeDefined();
    });

    it("should attempt install when autoInstall is true and backend is missing", async () => {
      let callCount = 0;
      mockExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        callCount++;
        if (callCount <= 1) {
          const err = new Error("ENOENT") as NodeJS.ErrnoException;
          err.code = "ENOENT";
          cb(err, "");
        } else {
          cb(null, "1.0.0");
        }
      }) as unknown as typeof execFile);

      mockTryInstall.mockResolvedValue({
        installed: true,
        method: "npm",
        attempts: [{ installed: true, method: "npm" }],
      });

      const result = await manager.ensureAvailable("test-backend", { autoInstall: true });
      expect(result.available).toBe(true);
      expect(result.alreadyInstalled).toBe(false);
      expect(result.installResult?.installed).toBe(true);
      expect(mockTryInstall).toHaveBeenCalled();
    });

    it("should return failure when install fails and re-check fails", async () => {
      mockExistenceCheckResult(false);
      mockTryInstall.mockResolvedValue({
        installed: false,
        attempts: [{ installed: false, method: "npm", error: "permission denied" }],
        manualInstructions: ["Download from https://test.com"],
      });

      const result = await manager.ensureAvailable("test-backend", { autoInstall: true });
      expect(result.available).toBe(false);
      expect(result.installResult?.installed).toBe(false);
    });

    it("should return not-available for unregistered backend", async () => {
      const result = await manager.ensureAvailable("nonexistent");
      expect(result.available).toBe(false);
    });
  });

  describe("installBackend", () => {
    it("should delegate to tryInstallMethods with filtered methods", async () => {
      mockTryInstall.mockResolvedValue({
        installed: true,
        method: "npm",
        attempts: [{ installed: true, method: "npm" }],
      });

      const result = await manager.installBackend("test-backend");
      expect(result.installed).toBe(true);
      expect(mockTryInstall).toHaveBeenCalled();
    });

    it("should return failure for backend with no install methods", async () => {
      const noInstallBackend: BackendDefinition = {
        name: "no-install",
        version: "1.0.0",
        supportedModes: ["resolve"],
      };
      manager.register(noInstallBackend);

      const result = await manager.installBackend("no-install");
      expect(result.installed).toBe(false);
      expect(result.manualInstructions?.[0]).toContain("No install methods defined");
    });
  });

  describe("ensureResolvePackageAvailable", () => {
    it("should return null for backend without resolvePackage", async () => {
      const noResolve: BackendDefinition = {
        name: "no-resolve",
        version: "1.0.0",
        supportedModes: ["resolve"],
      };
      manager.register(noResolve);

      const result = await manager.ensureResolvePackageAvailable("no-resolve");
      expect(result).toBeNull();
    });

    it("should return null when resolve command is already available", async () => {
      mockExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        cb(null, "1.0.0");
      }) as unknown as typeof execFile);

      const result = await manager.ensureResolvePackageAvailable("test-backend", { autoInstall: true });
      expect(result).toBeNull();
    });

    it("should not attempt install when autoInstall is false", async () => {
      mockExistenceCheckResult(false);
      const result = await manager.ensureResolvePackageAvailable("test-backend", { autoInstall: false });
      expect(result).toBeNull();
      expect(mockEnsureResolve).not.toHaveBeenCalled();
    });

    it("should attempt install when autoInstall is true and command is missing", async () => {
      mockExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        const err = new Error("ENOENT") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        cb(err, "");
      }) as unknown as typeof execFile);

      mockEnsureResolve.mockResolvedValue({ installed: true, method: "npm" });

      const result = await manager.ensureResolvePackageAvailable("test-backend", { autoInstall: true });
      expect(result).toEqual({ installed: true, method: "npm" });
      expect(mockEnsureResolve).toHaveBeenCalledWith("@test/acp-bridge");
    });
  });
});
