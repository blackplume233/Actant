import { describe, it, expect } from "vitest";
import { createCommunicator } from "../create-communicator";
import { ClaudeCodeCommunicator } from "../claude-code-communicator";
import { CursorCommunicator } from "../cursor-communicator";

describe("createCommunicator", () => {
  it("returns ClaudeCodeCommunicator for claude-code backend", () => {
    const comm = createCommunicator("claude-code");
    expect(comm).toBeInstanceOf(ClaudeCodeCommunicator);
  });

  it("returns CursorCommunicator for cursor backend", () => {
    const comm = createCommunicator("cursor");
    expect(comm).toBeInstanceOf(CursorCommunicator);
  });

  it("throws for unregistered backend", () => {
    expect(() => createCommunicator("custom")).toThrow("No communicator registered");
  });
});

describe("CursorCommunicator", () => {
  it("throws on runPrompt", async () => {
    const comm = new CursorCommunicator();
    await expect(comm.runPrompt("/tmp", "hello")).rejects.toThrow(
      "does not support programmatic communication",
    );
  });

  it("throws on streamPrompt", async () => {
    const comm = new CursorCommunicator();
    const iter = comm.streamPrompt("/tmp", "hello");
    await expect(async () => {
      for await (const _chunk of iter) { /* noop */ }
    }).rejects.toThrow("does not support programmatic communication");
  });
});

describe("ClaudeCodeCommunicator", () => {
  it("builds correct args for basic prompt", () => {
    const comm = new ClaudeCodeCommunicator();
    // Access private method via prototype for testing
    const args = (comm as unknown as { buildArgs: (p: string, o: undefined, f: string) => string[] })
      .buildArgs("hello world", undefined, "json");
    expect(args).toEqual(["-p", "--output-format", "json", "hello world"]);
  });

  it("builds args with all options", () => {
    const comm = new ClaudeCodeCommunicator();
    const options = {
      systemPromptFile: "/tmp/prompt.txt",
      appendSystemPrompt: "Be concise",
      sessionId: "abc123",
      maxTurns: 5,
      model: "sonnet",
    };
    const args = (comm as unknown as { buildArgs: (p: string, o: typeof options, f: string) => string[] })
      .buildArgs("test", options, "stream-json");
    expect(args).toContain("--system-prompt-file");
    expect(args).toContain("/tmp/prompt.txt");
    expect(args).toContain("--append-system-prompt");
    expect(args).toContain("Be concise");
    expect(args).toContain("--resume");
    expect(args).toContain("abc123");
    expect(args).toContain("--max-turns");
    expect(args).toContain("5");
    expect(args).toContain("--model");
    expect(args).toContain("sonnet");
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
  });

  it("handles spawn failure gracefully", async () => {
    const comm = new ClaudeCodeCommunicator("nonexistent-binary-12345");
    await expect(comm.runPrompt("/tmp", "hello")).rejects.toThrow("Failed to spawn");
  });
});
