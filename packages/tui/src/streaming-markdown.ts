import { Markdown, type MarkdownTheme, type Component } from "@mariozechner/pi-tui";
import type { StreamChunk } from "@actant/core";

/**
 * A Markdown component that can be progressively updated with streaming chunks.
 *
 * Wraps pi-tui's Markdown to allow appending text content as it arrives
 * from an async stream, calling setText on each text chunk to trigger
 * differential re-rendering.
 */
export class StreamingMarkdown implements Component {
  private inner: Markdown;
  private buffer = "";
  private tui: { requestRender(): void } | null;

  constructor(
    theme: MarkdownTheme,
    tui?: { requestRender(): void },
    paddingX = 1,
    paddingY = 0,
  ) {
    this.inner = new Markdown("", paddingX, paddingY, theme);
    this.tui = tui ?? null;
  }

  get text(): string {
    return this.buffer;
  }

  appendText(text: string): void {
    this.buffer += text;
    this.inner.setText(this.buffer);
    this.tui?.requestRender();
  }

  appendChunk(chunk: StreamChunk): void {
    switch (chunk.type) {
      case "text":
        this.appendText(chunk.content);
        break;
      case "result":
        if (!this.buffer) {
          this.appendText(chunk.content);
        }
        break;
      case "tool_use":
        this.appendText(`\n\`${chunk.content}\`\n`);
        break;
      case "error":
        this.appendText(`\n**Error:** ${chunk.content}\n`);
        break;
    }
  }

  /**
   * Consume an entire async stream of chunks, appending each to the display.
   * Returns the accumulated text buffer when the stream ends.
   */
  async consumeStream(stream: AsyncIterable<StreamChunk>): Promise<string> {
    for await (const chunk of stream) {
      this.appendChunk(chunk);
    }
    return this.buffer;
  }

  setText(text: string): void {
    this.buffer = text;
    this.inner.setText(text);
    this.tui?.requestRender();
  }

  clear(): void {
    this.setText("");
  }

  render(width: number): string[] {
    return this.inner.render(width);
  }

  invalidate(): void {
    this.inner.invalidate();
  }
}
