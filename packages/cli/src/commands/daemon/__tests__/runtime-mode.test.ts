import { afterEach, describe, expect, it, vi } from "vitest";

describe("shouldSpawnEmbeddedDaemon", () => {
  afterEach(() => {
    delete process.env["ACTANT_STANDALONE"];
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns true when standalone env is set", async () => {
    process.env["ACTANT_STANDALONE"] = "1";

    const { shouldSpawnEmbeddedDaemon } = await import("../runtime-mode");

    expect(shouldSpawnEmbeddedDaemon()).toBe(true);
  });

  it("falls back to shared SEA detection when env is absent", async () => {
    vi.doMock("@actant/shared/core", () => ({
      isSingleExecutable: () => true,
    }));

    const { shouldSpawnEmbeddedDaemon } = await import("../runtime-mode");

    expect(shouldSpawnEmbeddedDaemon()).toBe(true);
  });
});
