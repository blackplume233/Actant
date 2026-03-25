import { createLogger } from "@actant/shared";
import type { RecordCategory } from "@actant/shared";
import type { StreamChunk } from "../communicator/agent-communicator";
import type { ActantChannel, ChannelPromptResult } from "./types";
import { channelEventToRecordEntry, legacyChunkToChannelEvent } from "./event-compat";
import type { RecordSystem } from "../record/record-system";

const logger = createLogger("recording-channel");

/**
 * Generic decorator that wraps any ActantChannel and records all
 * StreamChunks and prompt lifecycle events to the unified RecordSystem.
 *
 * Operates at the Channel protocol layer — independent of backend
 * implementation (ACP, Claude SDK, Pi, etc.).
 */
export class RecordingChannelDecorator implements ActantChannel {
  constructor(
    private readonly inner: ActantChannel,
    private readonly recordSystem: RecordSystem,
    private readonly agentName: string,
    private readonly sessionIdResolver: () => string,
  ) {}

  get capabilities() {
    return this.inner.capabilities;
  }

  get isConnected(): boolean {
    return this.inner.isConnected;
  }

  async prompt(sessionId: string, text: string): Promise<ChannelPromptResult> {
    const textChunks: string[] = [];
    let resultText: string | undefined;
    let stopReason = "end_turn";

    for await (const chunk of this.streamPrompt(sessionId, text)) {
      if (chunk.type === "text") textChunks.push(chunk.content);
      else if (chunk.type === "result") {
        resultText = chunk.content;
        if (chunk.event?.type === "x_result_success") {
          stopReason = chunk.event.stopReason;
        }
      } else if (chunk.type === "error") {
        stopReason = "error";
        if (textChunks.length === 0) textChunks.push(chunk.content);
      }
    }

    return { stopReason, text: resultText ?? textChunks.join("") };
  }

  async *streamPrompt(sessionId: string, text: string): AsyncIterable<StreamChunk> {
    const activitySid = this.sessionIdResolver();

    this.recordSafe({
      category: "prompt",
      type: "prompt_sent",
      agentName: this.agentName,
      sessionId: activitySid,
      data: { content: text },
    });

    try {
      for await (const chunk of this.inner.streamPrompt(sessionId, text)) {
        this.recordEvent(activitySid, chunk.event ?? legacyChunkToChannelEvent(activitySid, chunk));
        yield chunk;
      }

      this.recordSafe({
        category: "prompt",
        type: "prompt_complete",
        agentName: this.agentName,
        sessionId: activitySid,
        data: { stopReason: "end_turn" },
      });
    } catch (err) {
      this.recordSafe({
        category: "prompt",
        type: "prompt_complete",
        agentName: this.agentName,
        sessionId: activitySid,
        data: { stopReason: "error", error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
  }

  async cancel(sessionId: string): Promise<void> {
    return this.inner.cancel(sessionId);
  }

  async newSession(options?: Parameters<NonNullable<ActantChannel["newSession"]>>[0]) {
    if (!this.inner.newSession) {
      throw new Error("newSession is not supported by the wrapped channel");
    }
    return this.inner.newSession(options);
  }

  async resumeSession(options: Parameters<NonNullable<ActantChannel["resumeSession"]>>[0]) {
    if (!this.inner.resumeSession) {
      throw new Error("resumeSession is not supported by the wrapped channel");
    }
    return this.inner.resumeSession(options);
  }

  async configure(options: Parameters<NonNullable<ActantChannel["configure"]>>[0]) {
    if (!this.inner.configure) {
      throw new Error("configure is not supported by the wrapped channel");
    }
    return this.inner.configure(options);
  }

  async setMcpServers(servers: Parameters<NonNullable<ActantChannel["setMcpServers"]>>[0]) {
    if (!this.inner.setMcpServers) {
      throw new Error("setMcpServers is not supported by the wrapped channel");
    }
    return this.inner.setMcpServers(servers);
  }

  async getMcpStatus() {
    if (!this.inner.getMcpStatus) {
      throw new Error("getMcpStatus is not supported by the wrapped channel");
    }
    return this.inner.getMcpStatus();
  }

  async registerHostTools(tools: Parameters<NonNullable<ActantChannel["registerHostTools"]>>[0]) {
    if (!this.inner.registerHostTools) {
      throw new Error("registerHostTools is not supported by the wrapped channel");
    }
    return this.inner.registerHostTools(tools);
  }

  async unregisterHostTools(toolNames: Parameters<NonNullable<ActantChannel["unregisterHostTools"]>>[0]) {
    if (!this.inner.unregisterHostTools) {
      throw new Error("unregisterHostTools is not supported by the wrapped channel");
    }
    return this.inner.unregisterHostTools(toolNames);
  }

  setCallbackHandler(hostServices: Parameters<NonNullable<ActantChannel["setCallbackHandler"]>>[0]) {
    if (!this.inner.setCallbackHandler) {
      throw new Error("setCallbackHandler is not supported by the wrapped channel");
    }
    return this.inner.setCallbackHandler(hostServices);
  }

  private recordEvent(activitySid: string, event: NonNullable<StreamChunk["event"]>): void {
    const mapped = channelEventToRecordEntry(event);
    if (!mapped) return;
    this.recordSafe({
      category: mapped.category,
      type: mapped.type,
      agentName: this.agentName,
      sessionId: activitySid,
      data: mapped.data,
    });
  }

  private recordSafe(entry: {
    category: RecordCategory;
    type: string;
    agentName: string;
    sessionId: string;
    data: unknown;
  }): void {
    this.recordSystem.record(entry).catch((e: unknown) => {
      logger.warn({ err: e, type: entry.type }, "Failed to record channel event");
    });
  }
}
