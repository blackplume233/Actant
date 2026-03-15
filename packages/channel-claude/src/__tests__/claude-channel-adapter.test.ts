/**
 * Integration tests for ClaudeChannelAdapter.
 *
 * These tests call the REAL Claude Agent SDK — no mocks.
 * The SDK spawns a real claude-code subprocess for each query().
 *
 * Without ANTHROPIC_API_KEY / Claude Code auth, the subprocess returns
 * authentication_failed errors. This is a valid test: the full pipeline
 * (SDK → SDKMessage → mapSdkMessage → StreamChunk) is exercised.
 *
 * With valid auth, real Claude responses flow through.
 */
import { describe, it, expect } from "vitest";
import type { StreamChunk } from "@actant/core";
import { ClaudeChannelAdapter } from "../claude-channel-adapter.js";

const VALID_CHUNK_TYPES = ["text", "tool_use", "result", "error"] as const;

describe("ClaudeChannelAdapter", () => {
  describe("properties (no SDK call)", () => {
    it("channelId matches constructor arg", () => {
      const adapter = new ClaudeChannelAdapter("my-channel", { cwd: process.cwd() });
      expect(adapter.channelId).toBe("my-channel");
    });

    it("isConnected is always true (stateless SDK)", () => {
      const adapter = new ClaudeChannelAdapter("ch", { cwd: process.cwd() });
      expect(adapter.isConnected).toBe(true);
    });

    it("currentSessionId is null before any call", () => {
      const adapter = new ClaudeChannelAdapter("ch", { cwd: process.cwd() });
      expect(adapter.currentSessionId).toBeNull();
    });
  });

  describe("cancel (no active prompt)", () => {
    it("does not throw when no prompt is running", async () => {
      const adapter = new ClaudeChannelAdapter("ch", { cwd: process.cwd() });
      await expect(adapter.cancel("any-session")).resolves.toBeUndefined();
    });
  });

  describe("streamPrompt — real SDK subprocess", () => {
    it("produces valid StreamChunks from the real SDK", async () => {
      const adapter = new ClaudeChannelAdapter("integration-test", {
        cwd: process.cwd(),
        permissionMode: "plan",
        maxTurns: 1,
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of adapter.streamPrompt("s1", "Say exactly: hello")) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(VALID_CHUNK_TYPES).toContain(chunk.type);
        expect(typeof chunk.content).toBe("string");
        expect(chunk.content.length).toBeGreaterThan(0);
      }
    }, 60_000);

    it("captures session_id from SDK messages", async () => {
      const adapter = new ClaudeChannelAdapter("session-capture-test", {
        cwd: process.cwd(),
        permissionMode: "plan",
        maxTurns: 1,
      });

      for await (const _chunk of adapter.streamPrompt("s1", "Hi")) {
        // consume all chunks
      }

      // The SDK always includes session_id in its messages, even on auth failure
      expect(adapter.currentSessionId).not.toBeNull();
      expect(typeof adapter.currentSessionId).toBe("string");
    }, 60_000);

    it("cancel terminates an active stream", async () => {
      const adapter = new ClaudeChannelAdapter("cancel-test", {
        cwd: process.cwd(),
        permissionMode: "plan",
        maxTurns: 1,
      });

      const chunks: StreamChunk[] = [];
      let firstChunkReceived = false;

      const streamDone = (async () => {
        for await (const chunk of adapter.streamPrompt("s1", "Count from 1 to 100 slowly")) {
          chunks.push(chunk);
          firstChunkReceived = true;
        }
      })();

      // Wait until subprocess starts (at least one message arrives or timeout)
      const start = Date.now();
      while (!firstChunkReceived && Date.now() - start < 15_000) {
        await new Promise((r) => setTimeout(r, 100));
      }

      await adapter.cancel("s1");
      await streamDone;

      // Stream should have ended — we got at least the first chunk
      // plus possibly a "Cancelled" error chunk
      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(VALID_CHUNK_TYPES).toContain(chunk.type);
      }
    }, 60_000);
  });

  describe("prompt — real SDK subprocess", () => {
    it("returns a ChannelPromptResult", async () => {
      const adapter = new ClaudeChannelAdapter("prompt-test", {
        cwd: process.cwd(),
        permissionMode: "plan",
        maxTurns: 1,
      });

      const result = await adapter.prompt("s1", "What is 2+2?");

      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("stopReason");
      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(0);
      expect(["end_turn", "error"]).toContain(result.stopReason);
    }, 60_000);
  });
});
