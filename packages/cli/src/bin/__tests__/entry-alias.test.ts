import { describe, expect, it } from "vitest";
import { buildHubAliasArgs, isActhubExecutable, resolveSeaInvocation } from "../entry-alias";

describe("entry alias resolution", () => {
  it("prepends hub for acthub invocations", () => {
    expect(buildHubAliasArgs(["status", "--format", "json"])).toEqual(["hub", "status", "--format", "json"]);
    expect(buildHubAliasArgs(["hub", "status"])).toEqual(["hub", "status"]);
  });

  it("detects acthub executable names", () => {
    expect(isActhubExecutable("C:\\Tools\\acthub.exe")).toBe(true);
    expect(isActhubExecutable("/usr/local/bin/acthub")).toBe(true);
    expect(isActhubExecutable("/usr/local/bin/actant")).toBe(false);
  });

  it("rewrites SEA argv for acthub standalone binaries", () => {
    expect(resolveSeaInvocation(["node", "acthub.exe", "status"], "C:\\Tools\\acthub.exe")).toEqual({
      argv: ["node", "acthub", "hub", "status"],
      name: "acthub",
    });
    expect(resolveSeaInvocation(["node", "actant.exe", "status"], "C:\\Tools\\actant.exe")).toEqual({
      argv: ["node", "actant.exe", "status"],
    });
  });
});
