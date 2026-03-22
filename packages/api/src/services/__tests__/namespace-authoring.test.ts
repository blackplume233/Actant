import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  readNamespaceConfigDocument,
  validateNamespaceDocument,
} from "../namespace-authoring";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "actant-namespace-authoring-"));
  tempDirs.push(dir);
  return dir;
}

describe("namespace authoring validation", () => {
  it("rejects user-declared mounts at the namespace root", async () => {
    const projectDir = await makeTempProject();
    await writeFile(
      join(projectDir, "actant.namespace.json"),
      JSON.stringify({
        version: 1,
        name: "invalid-root-mount",
        mounts: [
          { type: "hostfs", path: "/", options: { hostPath: "." } },
        ],
      }, null, 2),
      "utf-8",
    );

    const document = await readNamespaceConfigDocument(projectDir);
    const result = validateNamespaceDocument(document);

    expect(result.valid).toBe(false);
    expect(result.mountDeclarationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "mounts[0].path",
        message: expect.stringContaining('implicit root mount projection'),
      }),
    ]));
  });
});
