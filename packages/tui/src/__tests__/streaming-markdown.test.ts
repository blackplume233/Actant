import { describe, it, expect, vi } from "vitest";
import { StreamingMarkdown } from "../streaming-markdown";
import { actantMarkdownTheme } from "../theme";
import type { StreamChunk } from "@actant/core";

describe("StreamingMarkdown", () => {
  it("starts with empty text", () => {
    const sm = new StreamingMarkdown(actantMarkdownTheme);
    expect(sm.text).toBe("");
  });

  it("appends text chunks incrementally", () => {
    const sm = new StreamingMarkdown(actantMarkdownTheme);
    sm.appendText("Hello ");
    expect(sm.text).toBe("Hello ");
    sm.appendText("World");
    expect(sm.text).toBe("Hello World");
  });

  it("appends StreamChunk of type text", () => {
    const sm = new StreamingMarkdown(actantMarkdownTheme);
    sm.appendChunk({ type: "text", content: "chunk1 " });
    sm.appendChunk({ type: "text", content: "chunk2" });
    expect(sm.text).toBe("chunk1 chunk2");
  });

  it("appends result chunk only when buffer is empty", () => {
    const sm = new StreamingMarkdown(actantMarkdownTheme);
    sm.appendChunk({ type: "result", content: "final result" });
    expect(sm.text).toBe("final result");

    sm.appendChunk({ type: "result", content: "ignored" });
    expect(sm.text).toBe("final result");
  });

  it("appends tool_use as inline code", () => {
    const sm = new StreamingMarkdown(actantMarkdownTheme);
    sm.appendChunk({ type: "tool_use", content: "read_file" });
    expect(sm.text).toContain("`read_file`");
  });

  it("appends error chunk as bold error", () => {
    const sm = new StreamingMarkdown(actantMarkdownTheme);
    sm.appendChunk({ type: "error", content: "auth failed" });
    expect(sm.text).toContain("**Error:**");
    expect(sm.text).toContain("auth failed");
  });

  it("consumeStream processes entire async stream", async () => {
    const sm = new StreamingMarkdown(actantMarkdownTheme);
    async function* gen(): AsyncIterable<StreamChunk> {
      yield { type: "text", content: "Hello " };
      yield { type: "text", content: "from " };
      yield { type: "text", content: "stream" };
    }
    const result = await sm.consumeStream(gen());
    expect(result).toBe("Hello from stream");
    expect(sm.text).toBe("Hello from stream");
  });

  it("calls requestRender on TUI when appending", () => {
    const mockTui = { requestRender: vi.fn() };
    const sm = new StreamingMarkdown(actantMarkdownTheme, mockTui);
    sm.appendText("hello");
    expect(mockTui.requestRender).toHaveBeenCalled();
  });

  it("renders non-empty lines for non-empty text", () => {
    const sm = new StreamingMarkdown(actantMarkdownTheme);
    sm.appendText("# Title\n\nSome body text.");
    const lines = sm.render(80);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("clear resets the buffer", () => {
    const sm = new StreamingMarkdown(actantMarkdownTheme);
    sm.appendText("some content");
    sm.clear();
    expect(sm.text).toBe("");
  });

  it("setText replaces the buffer", () => {
    const sm = new StreamingMarkdown(actantMarkdownTheme);
    sm.appendText("old");
    sm.setText("new");
    expect(sm.text).toBe("new");
  });
});
