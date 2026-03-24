import { describe, it, expect } from "vitest";
import { getDefaultIpcPath, normalizeIpcPath } from "@actant/shared/core";

describe("defaultSocketPath behavior", () => {
  it("resolves ACTANT_SOCKET overrides the same way as the CLI entrypoint logic", () => {
    const home = ".trellis/tmp/demo-home";
    const socketOverride = ".trellis/tmp/demo-home/actant.sock";

    const actual = normalizeIpcPath(socketOverride, home);
    if (process.platform === "win32") {
      expect(actual.startsWith("\\\\.\\pipe\\actant-")).toBe(true);
    } else {
      expect(actual).toContain("actant.sock");
    }
  });

  it("resolves bare .sock overrides the same way as the CLI entrypoint logic", () => {
    const home = ".trellis/tmp/demo-home";

    const actual = normalizeIpcPath(".sock", home);
    if (process.platform === "win32") {
      expect(actual).toBe(getDefaultIpcPath(home));
    } else {
      expect(actual).toContain(".sock");
    }
  });

});
