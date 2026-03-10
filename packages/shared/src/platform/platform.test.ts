import { describe, it, expect } from "vitest";
import { getDefaultIpcPath, getIpcPath, ipcRequiresFileCleanup, isWindows, normalizeIpcPath } from "./platform";

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

  it("getDefaultIpcPath and getIpcPath resolve to the same path for the same homeDir", () => {
    const homeDir = "/tmp/actant-test";
    expect(getDefaultIpcPath(homeDir)).toBe(getIpcPath(homeDir));
  });

  it("normalizes ACTANT_SOCKET-style .sock override on Windows", () => {
    if (isWindows()) {
      const input = ".trellis/tmp/demo/actant.sock";
      expect(normalizeIpcPath(input, ".trellis/tmp/demo")).toBe(getIpcPath(".trellis/tmp/demo"));
    } else {
      expect(normalizeIpcPath(".trellis/tmp/demo/actant.sock")).toContain("actant.sock");
    }
  });

  it("getDefaultIpcPath without args matches getIpcPath with default home", () => {
    const defaultHome = process.env.HOME ?? process.env.USERPROFILE ?? ".";
    expect(getDefaultIpcPath()).toBe(getIpcPath(defaultHome.endsWith(".actant") ? defaultHome : `${defaultHome}/.actant`));
  });
});
