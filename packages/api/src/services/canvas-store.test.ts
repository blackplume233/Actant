import { describe, it, expect, beforeEach } from "vitest";
import { CanvasStore } from "./canvas-store";

describe("CanvasStore", () => {
  let store: CanvasStore;

  beforeEach(() => {
    store = new CanvasStore();
  });

  // ── update + get ─────────────────────────────────────────

  it("stores and retrieves a canvas entry", () => {
    store.update("agent-a", "<h1>Hello</h1>", "Dashboard");
    const entry = store.get("agent-a");

    expect(entry).toBeDefined();
    expect(entry!.agentName).toBe("agent-a");
    expect(entry!.html).toBe("<h1>Hello</h1>");
    expect(entry!.title).toBe("Dashboard");
    expect(entry!.updatedAt).toBeGreaterThan(0);
  });

  it("overwrites existing entry on second update", () => {
    store.update("agent-a", "<p>old</p>");
    store.update("agent-a", "<p>new</p>", "v2");
    const entry = store.get("agent-a");

    expect(entry!.html).toBe("<p>new</p>");
    expect(entry!.title).toBe("v2");
  });

  it("returns undefined for non-existent agent", () => {
    expect(store.get("ghost")).toBeUndefined();
  });

  it("title is optional", () => {
    store.update("agent-b", "<div/>");
    expect(store.get("agent-b")!.title).toBeUndefined();
  });

  // ── list ─────────────────────────────────────────────────

  it("lists all entries", () => {
    store.update("a", "<p>a</p>");
    store.update("b", "<p>b</p>");

    const entries = store.list();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.agentName).sort()).toEqual(["a", "b"]);
  });

  it("returns empty array when no entries", () => {
    expect(store.list()).toEqual([]);
  });

  // ── remove ───────────────────────────────────────────────

  it("removes an existing entry", () => {
    store.update("agent-c", "<p/>");
    expect(store.remove("agent-c")).toBe(true);
    expect(store.get("agent-c")).toBeUndefined();
  });

  it("returns false when removing non-existent entry", () => {
    expect(store.remove("ghost")).toBe(false);
  });

  it("remove does not affect other entries", () => {
    store.update("keep", "<p>keep</p>");
    store.update("drop", "<p>drop</p>");
    store.remove("drop");

    expect(store.list()).toHaveLength(1);
    expect(store.get("keep")).toBeDefined();
  });
});
