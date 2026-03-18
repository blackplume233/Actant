import { describe, it, expect, vi, afterEach } from "vitest";
import { createTestHarness, type TuiTestHarness } from "../testing";
import { ActantChatView, type ChatViewOptions } from "../chat-view";
import type { Terminal } from "@mariozechner/pi-tui";
import type { StreamChunk } from "@actant/agent-runtime";

let harness: TuiTestHarness;
let terminal: Terminal;
let chatView: ActantChatView;

async function setup(options?: ChatViewOptions) {
  const result = await createTestHarness(80, 24);
  harness = result.harness;
  terminal = result.terminal;
  chatView = new ActantChatView(terminal, options);
  return { harness, terminal, chatView };
}

describe("ActantChatView", () => {
  afterEach(() => {
    try { chatView?.stop(); } catch { /* already stopped */ }
  });

  describe("startup", () => {
    it("renders welcome banner on start", async () => {
      await setup({ title: "Test Chat" });
      chatView.start();
      const text = await harness.getViewportText();
      expect(text).toContain("Test Chat");
    });

    it("renders subtitle / instructions", async () => {
      await setup({ subtitle: "Press /exit to leave" });
      chatView.start();
      const text = await harness.getViewportText();
      expect(text).toContain("/exit");
    });

    it("renders the editor border (input area)", async () => {
      await setup();
      chatView.start();
      const viewport = await harness.getViewport();
      const hasHorizontalLine = viewport.some((line) =>
        /[─━┈┉╌╍═]/.test(line),
      );
      expect(hasHorizontalLine).toBe(true);
    });
  });

  describe("user input and submit", () => {
    it("calls onUserMessage when text is submitted", async () => {
      await setup();
      const handler = vi.fn(async (_text: string) => {});
      chatView.onUserMessage = handler;
      chatView.start();

      harness.sendInput("Hello world");
      await harness.getViewport(); // flush
      harness.sendInput("\r");
      await new Promise((r) => setTimeout(r, 100));

      expect(handler).toHaveBeenCalledWith("Hello world");
    });

    it("displays user message as markdown after submit", async () => {
      await setup();
      chatView.onUserMessage = async () => {};
      chatView.start();

      harness.sendInput("Test message");
      harness.sendInput("\r");

      const text = await harness.waitFor("Test message", 2000);
      expect(text).toBeDefined();
    });

    it("ignores empty submissions", async () => {
      await setup();
      const handler = vi.fn(async (_text: string) => {});
      chatView.onUserMessage = handler;
      chatView.start();

      harness.sendInput("\r");
      await new Promise((r) => setTimeout(r, 100));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("streaming response", () => {
    it("renders streamed text chunks as markdown", async () => {
      await setup();

      chatView.onUserMessage = async () => {
        const chunks: StreamChunk[] = [
          { type: "text", content: "Hello " },
          { type: "text", content: "from AI" },
        ];
        async function* gen() {
          for (const c of chunks) {
            yield c;
            await new Promise((r) => setTimeout(r, 20));
          }
        }
        await chatView.appendAssistantStream(gen());
      };

      chatView.start();
      harness.sendInput("hi");
      harness.sendInput("\r");

      const lines = await harness.waitFor("from AI", 3000);
      expect(lines).toBeDefined();
    });

    it("shows loader while waiting, then removes it", async () => {
      await setup();

      let resolveStream: (() => void) | null = null;
      chatView.onUserMessage = async () => {
        await new Promise<void>((r) => { resolveStream = r; });
        chatView.hideLoader();
        chatView.appendAssistantMessage("Done!");
      };

      chatView.start();
      harness.sendInput("go");
      harness.sendInput("\r");

      await new Promise((r) => setTimeout(r, 200));
      let text = await harness.getViewportText();
      expect(text).toContain("Thinking");

      resolveStream!();
      await new Promise((r) => setTimeout(r, 200));
      text = await harness.getViewportText();
      expect(text).toContain("Done!");
    });

    it("handles error chunks in stream", async () => {
      await setup();

      chatView.onUserMessage = async () => {
        async function* gen(): AsyncIterable<StreamChunk> {
          yield { type: "error", content: "something went wrong" };
        }
        await chatView.appendAssistantStream(gen());
      };

      chatView.start();
      harness.sendInput("fail");
      harness.sendInput("\r");

      const lines = await harness.waitFor("something went wrong", 3000);
      expect(lines).toBeDefined();
    });
  });

  describe("exit command", () => {
    it("/exit calls onExit handler and stops", async () => {
      await setup();
      const exitHandler = vi.fn(async () => {});
      chatView.onExit = exitHandler;
      chatView.start();

      harness.sendInput("/exit");
      harness.sendInput("\r");
      await new Promise((r) => setTimeout(r, 200));

      expect(exitHandler).toHaveBeenCalled();
    });
  });

  describe("cancel (Escape)", () => {
    it("calls onCancel when Escape pressed during response", async () => {
      await setup();
      const cancelHandler = vi.fn();
      chatView.onCancel = cancelHandler;

      let resolveStream: (() => void) | null = null;
      chatView.onUserMessage = async () => {
        async function* gen(): AsyncIterable<StreamChunk> {
          await new Promise<void>((r) => { resolveStream = r; });
          yield { type: "text", content: "late" };
        }
        await chatView.appendAssistantStream(gen());
      };

      chatView.start();
      harness.sendInput("go");
      harness.sendInput("\r");
      await new Promise((r) => setTimeout(r, 100));

      harness.sendInput("\x1b");
      await new Promise((r) => setTimeout(r, 100));

      expect(cancelHandler).toHaveBeenCalled();
      resolveStream!();
    });
  });
});
