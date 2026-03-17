import { describe, expect, it } from "vitest";
import { resolveApiPackageVersion } from "../package-version";

describe("resolveApiPackageVersion", () => {
  it("returns bundled version when provided", () => {
    expect(resolveApiPackageVersion({ bundledVersion: "0.3.0" })).toBe("0.3.0");
  });

  it("falls back to unknown when no dir or bundled version is available", () => {
    expect(
      resolveApiPackageVersion({
        thisDir: "/missing/api",
        readFile: () => {
          throw new Error("missing");
        },
      }),
    ).toBe("unknown");
  });

  it("reads package.json from candidate paths", () => {
    expect(
      resolveApiPackageVersion({
        thisDir: "/repo/packages/api/dist/services",
        readFile: (path) => {
          if (path.replace(/\\/g, "/").endsWith("/repo/packages/api/dist/package.json")) {
            return JSON.stringify({ version: "0.4.1" });
          }
          throw new Error("missing");
        },
      }),
    ).toBe("0.4.1");
  });
});
