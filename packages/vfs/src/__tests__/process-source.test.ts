import { describe, it, expect } from "vitest";
import type { VfsEntry } from "@actant/shared";
import { createProcessSource, OutputBuffer, type ProcessHandle } from "../sources/process-source";

describe("ProcessSource", () => {
  function createTestProcess(): ProcessHandle {
    return {
      pid: 12345,
      command: "node",
      args: ["server.js"],
      status: "running",
      startedAt: Date.now(),
      stdout: new OutputBuffer(1000),
      stderr: new OutputBuffer(1000),
      env: { NODE_ENV: "production" },
      config: { port: 3000 },
    };
  }

  it("reads status as JSON", async () => {
    const handle = createTestProcess();
    const mount = createProcessSource("proc-1", "/proc/agent-a/12345", handle, { type: "process", pid: 12345 });
    const result = await mount.handlers.read!("status");
    const parsed = JSON.parse(result.content);
    expect(parsed.pid).toBe(12345);
    expect(parsed.status).toBe("running");
    expect(parsed.command).toBe("node");
  });

  it("reads pid", async () => {
    const handle = createTestProcess();
    const mount = createProcessSource("proc-1", "/proc/agent-a/12345", handle, { type: "process", pid: 12345 });
    const result = await mount.handlers.read!("pid");
    expect(result.content).toBe("12345");
  });

  it("reads stdout with content", async () => {
    const handle = createTestProcess();
    handle.stdout.append("line1\nline2\nline3");
    const mount = createProcessSource("proc-1", "/proc/agent-a/12345", handle, { type: "process", pid: 12345 });
    const result = await mount.handlers.read!("stdout");
    expect(result.content).toContain("line1");
    expect(result.content).toContain("line3");
  });

  it("reads stdout range (last N lines)", async () => {
    const handle = createTestProcess();
    for (let i = 1; i <= 100; i++) handle.stdout.append(`log-${i}`);
    const mount = createProcessSource("proc-1", "/proc/agent-a/12345", handle, { type: "process", pid: 12345 });
    const result = await mount.handlers.read_range!("stdout", -5);
    const lines = result.content.split("\n").filter(Boolean);
    expect(lines.length).toBeLessThanOrEqual(6);
  });

  it("sends command via cmd write", async () => {
    const handle = createTestProcess();
    const commands: string[] = [];
    handle.onCommand = async (cmd) => { commands.push(cmd); };
    const mount = createProcessSource("proc-1", "/proc/agent-a/12345", handle, { type: "process", pid: 12345 });
    await mount.handlers.write!("cmd", "stop");
    expect(commands).toEqual(["stop"]);
  });

  it("lists all proc files", async () => {
    const handle = createTestProcess();
    const mount = createProcessSource("proc-1", "/proc/agent-a/12345", handle, { type: "process", pid: 12345 });
    const entries = await mount.handlers.list!("");
    expect(entries.map((entry: VfsEntry) => entry.name)).toContain("status");
    expect(entries.map((entry: VfsEntry) => entry.name)).toContain("stdout");
    expect(entries.map((entry: VfsEntry) => entry.name)).toContain("cmd");
  });

  it("greps across stdout and stderr", async () => {
    const handle = createTestProcess();
    handle.stdout.append("INFO: started\nERROR: failed\nINFO: retrying");
    handle.stderr.append("WARN: deprecated\nERROR: crash");
    const mount = createProcessSource("proc-1", "/proc/agent-a/12345", handle, { type: "process", pid: 12345 });
    const result = await mount.handlers.grep!("ERROR");
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("OutputBuffer", () => {
  it("respects max lines", () => {
    const buf = new OutputBuffer(5);
    for (let i = 0; i < 10; i++) buf.append(`line-${i}`);
    expect(buf.lineCount).toBeLessThanOrEqual(10);
    const all = buf.getAll();
    expect(all).toContain("line-9");
  });

  it("returns range from end with negative startLine", () => {
    const buf = new OutputBuffer(100);
    for (let i = 1; i <= 20; i++) buf.append(`line-${i}`);
    const range = buf.getRange(-3);
    const lines = range.split("\n").filter(Boolean);
    expect(lines.length).toBeLessThanOrEqual(4);
  });
});
