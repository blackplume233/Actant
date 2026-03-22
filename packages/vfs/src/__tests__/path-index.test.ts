import { describe, it, expect, beforeEach } from "vitest";
import { PathIndex } from "../index/path-index";

describe("PathIndex", () => {
  let idx: PathIndex;

  beforeEach(() => {
    idx = new PathIndex();
  });

  it("adds and retrieves entries", () => {
    idx.add({ vfsPath: "/memory/agent-a/notes.md", mountName: "mem-a", mountPoint: "/memory/agent-a", type: "file" });
    const entry = idx.get("/memory/agent-a/notes.md");
    expect(entry).toBeDefined();
    if (!entry) {
      throw new Error("Expected path index entry for /memory/agent-a/notes.md");
    }
    expect(entry.mountName).toBe("mem-a");
  });

  it("lists directory contents", () => {
    idx.add({ vfsPath: "/memory/agent-a/a.md", mountName: "mem-a", mountPoint: "/memory/agent-a", type: "file" });
    idx.add({ vfsPath: "/memory/agent-a/b.md", mountName: "mem-a", mountPoint: "/memory/agent-a", type: "file" });
    idx.add({ vfsPath: "/memory/agent-a/sub/c.md", mountName: "mem-a", mountPoint: "/memory/agent-a", type: "file" });
    const entries = idx.listDir("/memory/agent-a", false);
    expect(entries).toHaveLength(2);
  });

  it("lists directory recursively", () => {
    idx.add({ vfsPath: "/memory/agent-a/a.md", mountName: "mem-a", mountPoint: "/memory/agent-a", type: "file" });
    idx.add({ vfsPath: "/memory/agent-a/sub/c.md", mountName: "mem-a", mountPoint: "/memory/agent-a", type: "file" });
    const entries = idx.listDir("/memory/agent-a", true);
    expect(entries).toHaveLength(2);
  });

  it("glob matches paths", () => {
    idx.add({ vfsPath: "/workspace/src/index.ts", mountName: "ws", mountPoint: "/workspace", type: "file" });
    idx.add({ vfsPath: "/workspace/src/utils.ts", mountName: "ws", mountPoint: "/workspace", type: "file" });
    idx.add({ vfsPath: "/workspace/src/utils.js", mountName: "ws", mountPoint: "/workspace", type: "file" });
    const matches = idx.glob("/workspace/src/*.ts");
    expect(matches).toHaveLength(2);
  });

  it("retrieves entries by mount point", () => {
    idx.add({ vfsPath: "/memory/a/x", mountName: "a", mountPoint: "/memory/a", type: "file" });
    idx.add({ vfsPath: "/memory/b/y", mountName: "b", mountPoint: "/memory/b", type: "file" });
    const entries = idx.byMountPoint("/memory/a");
    expect(entries).toHaveLength(1);
  });

  it("serializes and deserializes", () => {
    idx.add({ vfsPath: "/test/a", mountName: "t", mountPoint: "/test", type: "file" });
    idx.add({ vfsPath: "/test/b", mountName: "t", mountPoint: "/test", type: "file" });
    const json = idx.serialize();

    const idx2 = new PathIndex();
    idx2.deserialize(json);
    expect(idx2.size).toBe(2);
    expect(idx2.get("/test/a")).toBeDefined();
  });

  it("removes entries", () => {
    idx.add({ vfsPath: "/test/a", mountName: "t", mountPoint: "/test", type: "file" });
    expect(idx.remove("/test/a")).toBe(true);
    expect(idx.get("/test/a")).toBeUndefined();
    expect(idx.size).toBe(0);
  });
});
