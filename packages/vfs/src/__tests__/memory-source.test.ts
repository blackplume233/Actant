import { describe, it, expect } from "vitest";
import type { VfsEntry } from "@actant/shared";
import { memorySourceFactory } from "../sources/memory-source";

describe("MemorySource", () => {
  function createMemoryMount() {
    const reg = memorySourceFactory.create(
      { type: "memory", maxSize: "1mb" },
      "/memory/agent-a",
      { type: "agent", agentName: "agent-a" },
    );
    reg.name = "mem-test";
    return reg;
  }

  it("writes and reads a file", async () => {
    const mount = createMemoryMount();
    await mount.handlers.write!("notes.md", "Hello VFS");
    const result = await mount.handlers.read!("notes.md");
    expect(result.content).toBe("Hello VFS");
  });

  it("throws on read of nonexistent file", async () => {
    const mount = createMemoryMount();
    await expect(mount.handlers.read!("missing.md")).rejects.toThrow("File not found");
  });

  it("lists files", async () => {
    const mount = createMemoryMount();
    await mount.handlers.write!("a.md", "A");
    await mount.handlers.write!("b.md", "B");
    const entries = await mount.handlers.list!("");
    expect(entries).toHaveLength(2);
    expect(entries.map((entry: VfsEntry) => entry.name)).toContain("a.md");
  });

  it("overwrites existing file", async () => {
    const mount = createMemoryMount();
    const r1 = await mount.handlers.write!("f.md", "v1");
    expect(r1.created).toBe(true);
    const r2 = await mount.handlers.write!("f.md", "v2");
    expect(r2.created).toBe(false);
    const result = await mount.handlers.read!("f.md");
    expect(result.content).toBe("v2");
  });

  it("stats written files", async () => {
    const mount = createMemoryMount();
    await mount.handlers.write!("f.md", "v1");
    const stat = await mount.handlers.stat!("f.md");
    expect(stat.type).toBe("file");
    expect(stat.size).toBe(2);
  });

  it("greps content across files", async () => {
    const mount = createMemoryMount();
    await mount.handlers.write!("a.md", "line1\nERROR here\nline3");
    await mount.handlers.write!("b.md", "all good");
    const result = await mount.handlers.grep!("ERROR");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.path).toBe("a.md");
    expect(result.matches[0]!.line).toBe(2);
  });
});
