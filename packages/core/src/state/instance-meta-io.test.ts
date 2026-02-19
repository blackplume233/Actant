import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentInstanceMeta } from "@agentcraft/shared";
import { InstanceCorruptedError } from "@agentcraft/shared";
import {
  readInstanceMeta,
  writeInstanceMeta,
  updateInstanceMeta,
  scanInstances,
} from "./instance-meta-io";

function makeMeta(overrides?: Partial<AgentInstanceMeta>): AgentInstanceMeta {
  const now = new Date().toISOString();
  return {
    id: "test-uuid-1234",
    name: "test-agent",
    templateName: "test-template",
    templateVersion: "1.0.0",
    status: "created",
    launchMode: "direct",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("instance-meta-io", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "agentcraft-meta-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("writeInstanceMeta + readInstanceMeta", () => {
    it("should write and read back metadata correctly", async () => {
      const meta = makeMeta();
      await writeInstanceMeta(tmpDir, meta);
      const result = await readInstanceMeta(tmpDir);

      expect(result.id).toBe(meta.id);
      expect(result.name).toBe(meta.name);
      expect(result.templateName).toBe(meta.templateName);
      expect(result.status).toBe("created");
    });

    it("should write valid JSON to disk", async () => {
      const meta = makeMeta();
      await writeInstanceMeta(tmpDir, meta);
      const raw = await readFile(join(tmpDir, ".agentcraft.json"), "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.name).toBe("test-agent");
    });

    it("should handle metadata with optional fields", async () => {
      const meta = makeMeta({ pid: 12345, metadata: { env: "production" } });
      await writeInstanceMeta(tmpDir, meta);
      const result = await readInstanceMeta(tmpDir);

      expect(result.pid).toBe(12345);
      expect(result.metadata).toEqual({ env: "production" });
    });
  });

  describe("readInstanceMeta error cases", () => {
    it("should throw InstanceCorruptedError when file is missing", async () => {
      const emptyDir = join(tmpDir, "empty");
      await mkdir(emptyDir);

      await expect(readInstanceMeta(emptyDir)).rejects.toThrow(InstanceCorruptedError);
    });

    it("should throw InstanceCorruptedError for invalid JSON", async () => {
      await writeFile(join(tmpDir, ".agentcraft.json"), "not json{{{", "utf-8");
      await expect(readInstanceMeta(tmpDir)).rejects.toThrow(InstanceCorruptedError);
    });

    it("should throw InstanceCorruptedError for invalid schema", async () => {
      await writeFile(
        join(tmpDir, ".agentcraft.json"),
        JSON.stringify({ foo: "bar" }),
        "utf-8",
      );
      await expect(readInstanceMeta(tmpDir)).rejects.toThrow(InstanceCorruptedError);
    });
  });

  describe("updateInstanceMeta", () => {
    it("should update specific fields and preserve others", async () => {
      const meta = makeMeta();
      await writeInstanceMeta(tmpDir, meta);

      const updated = await updateInstanceMeta(tmpDir, { status: "running", pid: 9999 });

      expect(updated.status).toBe("running");
      expect(updated.pid).toBe(9999);
      expect(updated.name).toBe("test-agent");
      expect(updated.updatedAt).not.toBe(meta.updatedAt);
    });
  });

  describe("scanInstances", () => {
    it("should find valid instances and report corrupted ones", async () => {
      const validDir = join(tmpDir, "valid-agent");
      const corruptedDir = join(tmpDir, "corrupted-agent");
      await mkdir(validDir);
      await mkdir(corruptedDir);

      await writeInstanceMeta(validDir, makeMeta({ name: "valid-agent" }));
      await writeFile(join(corruptedDir, ".agentcraft.json"), "broken", "utf-8");

      const { valid, corrupted } = await scanInstances(tmpDir);

      expect(valid).toHaveLength(1);
      expect(valid[0]!.name).toBe("valid-agent");
      expect(corrupted).toEqual(["corrupted-agent"]);
    });

    it("should return empty for non-existent directory", async () => {
      const { valid, corrupted } = await scanInstances("/tmp/nonexistent-agentcraft-test");
      expect(valid).toEqual([]);
      expect(corrupted).toEqual([]);
    });

    it("should skip dot-directories", async () => {
      const dotDir = join(tmpDir, ".hidden");
      await mkdir(dotDir);
      await writeInstanceMeta(dotDir, makeMeta({ name: ".hidden" }));

      const { valid } = await scanInstances(tmpDir);
      expect(valid).toHaveLength(0);
    });

    it("should scan multiple valid instances", async () => {
      for (const name of ["agent-a", "agent-b", "agent-c"]) {
        const dir = join(tmpDir, name);
        await mkdir(dir);
        await writeInstanceMeta(dir, makeMeta({ name }));
      }

      const { valid } = await scanInstances(tmpDir);
      expect(valid).toHaveLength(3);
      expect(valid.map((m) => m.name).sort()).toEqual(["agent-a", "agent-b", "agent-c"]);
    });
  });
});
