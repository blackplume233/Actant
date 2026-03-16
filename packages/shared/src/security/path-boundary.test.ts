import { describe, it, expect } from "vitest";
import { ensureWithinWorkspace, safeResolvePath } from "./path-boundary";
import { PathOutsideWorkspaceError } from "../errors/bridge-errors";

describe("path-boundary", () => {
  const base = "/workspace/project";

  describe("ensureWithinWorkspace", () => {
    it("returns resolved path when within workspace", () => {
      expect(ensureWithinWorkspace(base, "src/index.ts")).toMatch(/src[\\/]index\.ts$/);
      expect(ensureWithinWorkspace(base, "./config")).toMatch(/config$/);
      expect(ensureWithinWorkspace(base, "a/b/c")).toMatch(/a[\\/]b[\\/]c$/);
    });

    it("throws PathOutsideWorkspaceError for traversal outside workspace", () => {
      expect(() => ensureWithinWorkspace(base, "../etc/passwd")).toThrow(PathOutsideWorkspaceError);
      expect(() => ensureWithinWorkspace(base, "../../../etc/passwd")).toThrow(PathOutsideWorkspaceError);
      expect(() => ensureWithinWorkspace(base, "foo/../../../etc/passwd")).toThrow(PathOutsideWorkspaceError);
    });

    it("throws PathOutsideWorkspaceError for absolute path outside workspace", () => {
      expect(() => ensureWithinWorkspace(base, "/etc/passwd")).toThrow(PathOutsideWorkspaceError);
    });

    it("allows workspace root", () => {
      const result = ensureWithinWorkspace(base, ".");
      expect(result).toMatch(/project$/);
    });
  });

  describe("safeResolvePath", () => {
    it("resolves and validates single segment", () => {
      const result = safeResolvePath(base, "src/main.ts");
      expect(result).toMatch(/src[\\/]main\.ts$/);
    });

    it("resolves and validates multiple segments", () => {
      const result = safeResolvePath(base, "foo", "bar", "baz");
      expect(result).toMatch(/foo[\\/]bar[\\/]baz$/);
    });

    it("throws PathOutsideWorkspaceError for traversal", () => {
      expect(() => safeResolvePath(base, "..", "etc", "passwd")).toThrow(PathOutsideWorkspaceError);
    });
  });
});
