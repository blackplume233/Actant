import { describe, it, expect, afterEach } from "vitest";
import { createTestHarness, type TuiTestHarness } from "../testing";
import { ActantChatView } from "../chat-view";
import type { Terminal } from "@mariozechner/pi-tui";
import type { StreamChunk } from "@actant/agent-runtime";

let harness: TuiTestHarness;
let terminal: Terminal;
let chatView: ActantChatView;

async function setup() {
  const result = await createTestHarness(120, 40);
  harness = result.harness;
  terminal = result.terminal;
  chatView = new ActantChatView(terminal, {
    title: "Stress Test",
    subtitle: "Edge case validation",
  });
  return { harness, terminal, chatView };
}

describe("TUI Stress Tests", () => {
  afterEach(() => {
    try { chatView?.stop(); } catch { /* ok */ }
  });

  it("handles very long input (1000+ chars)", async () => {
    await setup();
    const longText = "A".repeat(1200);
    chatView.onUserMessage = async () => {};
    chatView.start();

    harness.sendInput(longText);
    harness.sendInput("\r");
    await new Promise((r) => setTimeout(r, 200));

    const text = await harness.getViewportText();
    expect(text).toBeDefined();
  });

  it("handles unicode / emoji input", async () => {
    await setup();
    let received = "";
    chatView.onUserMessage = async (text) => { received = text; };
    chatView.start();

    harness.sendInput("你好世界 🚀✨🎉");
    harness.sendInput("\r");
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toContain("你好世界");
  });

  it("handles rapid successive Enter presses without crash", async () => {
    await setup();
    let callCount = 0;
    chatView.onUserMessage = async () => { callCount++; };
    chatView.start();

    for (let i = 0; i < 20; i++) {
      harness.sendInput("\r");
    }
    await new Promise((r) => setTimeout(r, 300));

    expect(callCount).toBe(0);
  });

  it("handles large streaming response (100+ chunks)", async () => {
    await setup();

    chatView.onUserMessage = async () => {
      async function* gen(): AsyncIterable<StreamChunk> {
        for (let i = 0; i < 150; i++) {
          yield { type: "text", content: `chunk-${i} ` };
        }
      }
      await chatView.appendAssistantStream(gen());
    };

    chatView.start();
    harness.sendInput("go");
    harness.sendInput("\r");

    await harness.waitFor("chunk-149", 5000);
    const text = await harness.getViewportText();
    expect(text).toContain("chunk-");
  });

  it("handles mixed empty and non-empty chunks", async () => {
    await setup();

    chatView.onUserMessage = async () => {
      async function* gen(): AsyncIterable<StreamChunk> {
        yield { type: "text", content: "" };
        yield { type: "text", content: "visible" };
        yield { type: "text", content: "" };
        yield { type: "text", content: " text" };
        yield { type: "text", content: "" };
      }
      await chatView.appendAssistantStream(gen());
    };

    chatView.start();
    harness.sendInput("test");
    harness.sendInput("\r");

    const lines = await harness.waitFor("visible", 3000);
    expect(lines).toBeDefined();
  });

  it("handles Escape when not responding (no-op)", async () => {
    await setup();
    const cancelHandler = { called: false };
    chatView.onCancel = () => { cancelHandler.called = true; };
    chatView.start();

    harness.sendInput("\x1b");
    await new Promise((r) => setTimeout(r, 100));

    expect(cancelHandler.called).toBe(false);
  });

  it("handles multiple sequential conversations", async () => {
    await setup();
    let msgCount = 0;

    chatView.onUserMessage = async () => {
      msgCount++;
      async function* gen(): AsyncIterable<StreamChunk> {
        yield { type: "text", content: `Reply ${msgCount}` };
      }
      await chatView.appendAssistantStream(gen());
    };

    chatView.start();

    harness.sendInput("msg1");
    harness.sendInput("\r");
    await harness.waitFor("Reply 1", 3000);

    harness.sendInput("msg2");
    harness.sendInput("\r");
    await harness.waitFor("Reply 2", 3000);

    harness.sendInput("msg3");
    harness.sendInput("\r");
    await harness.waitFor("Reply 3", 3000);

    expect(msgCount).toBe(3);
  });
});
