import { describe, expect, it } from "vitest";
import {
  createDomainSource,
  createSnapshotDomainSource,
  type DomainComponentSnapshot,
} from "../sources/domain-source";

describe("Domain source snapshots", () => {
  it("freezes component content for snapshot-backed mounts", async () => {
    const components: DomainComponentSnapshot[] = [
      {
        name: "alpha",
        description: "first",
        content: "original",
        tags: ["one"],
      },
    ];

    const snapshotMount = createSnapshotDomainSource(components, "skills", "/skills", { type: "daemon" });
    components[0]!.content = "mutated";
    components.push({ name: "beta", content: "later" });

    const entries = await snapshotMount.handlers.list!("");
    const readAlpha = await snapshotMount.handlers.read!("alpha");

    expect(entries.map((entry) => entry.path)).toEqual(["_catalog.json", "alpha"]);
    expect(readAlpha.content).toBe("original");
  });

  it("keeps manager-backed mounts live", async () => {
    const state: DomainComponentSnapshot[] = [
      {
        name: "alpha",
        content: "original",
      },
    ];
    const manager = {
      list: () => state,
      get: (name: string) => state.find((entry) => entry.name === name),
      search: (_query: string) => state,
    };

    const liveMount = createDomainSource(manager, "skills", "/skills", { type: "daemon" });
    state[0]!.content = "mutated";
    state.push({ name: "beta", content: "later" });

    const entries = await liveMount.handlers.list!("");
    const readAlpha = await liveMount.handlers.read!("alpha");

    expect(entries.map((entry) => entry.path)).toEqual(["_catalog.json", "alpha", "beta"]);
    expect(readAlpha.content).toBe("mutated");
  });
});
