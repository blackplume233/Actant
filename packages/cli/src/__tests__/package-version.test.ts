import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { resolveCliPackageVersion } from "../package-version";

describe("resolveCliPackageVersion", () => {
  it("reads version from the nearest package.json candidate", () => {
    const version = resolveCliPackageVersion({
      thisDir: "/repo/packages/cli/dist",
      readFile: (path) => {
        if (path === join("/repo/packages/cli/dist", "../package.json")) {
          return JSON.stringify({ version: "1.2.3" });
        }
        throw new Error(`unexpected path: ${path}`);
      },
    });

    expect(version).toBe("1.2.3");
  });

  it("falls back to the bundled version when package.json is unavailable", () => {
    const version = resolveCliPackageVersion({
      bundledVersion: "9.9.9",
      thisDir: "/standalone/blob",
      readFile: () => {
        throw new Error("ENOENT");
      },
    });

    expect(version).toBe("9.9.9");
  });

  it("prefers the bundled version in build-like environments", () => {
    const version = resolveCliPackageVersion({
      bundledVersion: "9.9.9",
    });

    expect(version).toBe("9.9.9");
  });

  it("returns unknown when neither package.json nor a bundled version is available", () => {
    const version = resolveCliPackageVersion({
      thisDir: "/standalone/blob",
      readFile: () => {
        throw new Error("ENOENT");
      },
    });

    expect(version).toBe("unknown");
  });
});
