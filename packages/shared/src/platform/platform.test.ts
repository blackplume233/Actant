import { describe, it, expect } from "vitest";
import { getDefaultIpcPath, getIpcPath, ipcRequiresFileCleanup, isWindows } from "./platform";

describe("platform utilities", () => {
  it("getDefaultIpcPath returns a non-empty string", () => {
    const path = getDefaultIpcPath();
    expect(path).toBeTruthy();
    expect(typeof path).toBe("string");
  });

  it("getIpcPath returns a non-empty string for any homeDir", () => {
    const path = getIpcPath("/tmp/test-home");
    expect(path).toBeTruthy();
  });

  it("getDefaultIpcPath with custom homeDir uses that directory", () => {
    if (!isWindows()) {
      const path = getDefaultIpcPath("/custom/home");
      expect(path).toContain("/custom/home");
      expect(path).toContain("actant.sock");
    }
  });

  it("ipcRequiresFileCleanup matches platform expectation", () => {
    if (isWindows()) {
      expect(ipcRequiresFileCleanup()).toBe(false);
    } else {
      expect(ipcRequiresFileCleanup()).toBe(true);
    }
  });

  it("isWindows returns a boolean", () => {
    expect(typeof isWindows()).toBe("boolean");
    expect(isWindows()).toBe(process.platform === "win32");
  });

  it("getIpcPath produces different paths for different homeDirs", () => {
    const path1 = getIpcPath("/home/a");
    const path2 = getIpcPath("/home/b");
    expect(path1).not.toBe(path2);
  });
});
