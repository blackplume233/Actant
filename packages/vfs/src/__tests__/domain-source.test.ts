import { describe, expect, it } from "vitest";
import type { VfsEntry } from "@actant/shared";
import {
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

    expect((entries as VfsEntry[]).map((entry: VfsEntry) => entry.path)).toEqual(["_catalog.json", "alpha"]);
    expect(readAlpha.content).toBe("original");
  });
});
