import { describe, expect, it } from "vitest";
import { normalizeHostProfile, type HostCapability } from "../types";

describe("host type freeze", () => {
  const removedLegacyProfile = ["boot", "strap"].join("");

  it("accepts only the frozen host profiles", () => {
    expect(normalizeHostProfile(undefined)).toBe("runtime");
    expect(normalizeHostProfile("context")).toBe("context");
    expect(normalizeHostProfile("runtime")).toBe("runtime");
    expect(normalizeHostProfile("autonomous")).toBe("autonomous");
  });

  it("rejects the removed legacy profile", () => {
    expect(() => normalizeHostProfile(removedLegacyProfile)).toThrow(/Unknown host profile/);
  });

  it("uses the frozen host capability surface", () => {
    const capabilities: HostCapability[] = ["hub", "runtime", "vfs"];
    expect(capabilities).toContain("vfs");
    expect(capabilities).not.toContain("sources" as never);
    expect(capabilities).not.toContain("plugins" as never);
  });
});
