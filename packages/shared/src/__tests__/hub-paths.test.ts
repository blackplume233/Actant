import { describe, expect, it } from "vitest";
import { HUB_MOUNT_LAYOUT, HUB_PATH_ALIASES, mapHubPath } from "../hub-paths";

describe("hub path mapping", () => {
  it("maps documented aliases to hub-prefixed paths", () => {
    expect(mapHubPath("/workspace/docs/readme.md")).toBe("/hub/workspace/docs/readme.md");
    expect(mapHubPath("/project/src/index.ts")).toBe("/hub/project/src/index.ts");
    expect(mapHubPath("/_project.json")).toBe("/hub/_project.json");
  });

  it("keeps unmapped paths unchanged", () => {
    expect(mapHubPath("/hub/workspace")).toBe("/hub/workspace");
    expect(mapHubPath("/daemon/info")).toBe("/daemon/info");
    expect(mapHubPath("/")).toBe("/");
  });

  it("matches longer prefixes before legacy fallbacks", () => {
    expect(HUB_PATH_ALIASES.find(([from]) => from === "/mcp/configs")).toBeDefined();
    expect(HUB_PATH_ALIASES.find(([from]) => from === "/mcp")).toBeDefined();
    expect(mapHubPath("/mcp/configs/server.json")).toBe("/hub/mcp/configs/server.json");
    expect(mapHubPath("/mcp/runtime/state.json")).toBe("/hub/mcp/runtime/state.json");
    expect(mapHubPath("/mcp/legacy.json")).toBe("/hub/mcp/legacy.json");
  });

  it("exposes the shared hub mount layout", () => {
    expect(HUB_MOUNT_LAYOUT.workspace).toBe("/hub/workspace");
    expect(HUB_MOUNT_LAYOUT.mcpConfigs).toBe("/hub/mcp/configs");
    expect(HUB_MOUNT_LAYOUT.templates).toBe("/hub/templates");
  });
});
