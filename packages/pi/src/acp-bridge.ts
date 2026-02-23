#!/usr/bin/env node

import { Writable, Readable } from "node:stream";
import {
  AgentSideConnection,
  ndJsonStream,
  type Agent as AcpAgent,
  type InitializeResponse,
  type NewSessionResponse,
  type PromptResponse,
} from "@agentclientprotocol/sdk";
import { Agent as PiAgent } from "@mariozechner/pi-agent-core";
// @mariozechner/pi-ai imports removed — SDK API drift (#121)
import { createPiAgent, type PiAgentOptions } from "./pi-tool-bridge";

interface SessionState {
  agent: PiAgent;
  cwd: string;
  abortController: AbortController;
}

const sessions = new Map<string, SessionState>();
let sessionCounter = 0;

function buildAgentHandler(conn: AgentSideConnection): AcpAgent {
  return {
    initialize: async (_params): Promise<InitializeResponse> => {
      return {
        protocolVersion: 1,
        agentCapabilities: {},
        agentInfo: {
          name: "pi-acp-bridge",
          version: "0.1.0",
        },
      } as InitializeResponse;
    },

    newSession: async (params): Promise<NewSessionResponse> => {
      const sessionId = `pi-session-${++sessionCounter}`;
      const cwd = params.cwd ?? process.cwd();

      const agentOpts: PiAgentOptions = {
        workspaceDir: cwd,
        provider: process.env["PI_PROVIDER"] ?? "anthropic",
        model: process.env["PI_MODEL"] ?? "claude-sonnet-4-20250514",
        apiKey: process.env["ANTHROPIC_API_KEY"] ?? process.env["OPENAI_API_KEY"],
        thinkingLevel: (process.env["PI_THINKING_LEVEL"] as PiAgentOptions["thinkingLevel"]) ?? undefined,
        systemPrompt: "You are a helpful coding assistant. You have access to file and command tools.",
      };

      const agent = createPiAgent(agentOpts);
      sessions.set(sessionId, {
        agent,
        cwd,
        abortController: new AbortController(),
      });

      return { sessionId } as NewSessionResponse;
    },

    prompt: async (params): Promise<PromptResponse> => {
      const session = sessions.get(params.sessionId);
      if (!session) {
        throw new Error(`Session "${params.sessionId}" not found`);
      }

      const promptText = params.content
        ?.filter((b: { type: string }) => b.type === "text")
        .map((b: { text?: string }) => b.text ?? "")
        .join("") ?? "";

      if (!promptText) {
        return { stopReason: "end_turn" } as PromptResponse;
      }

      session.abortController = new AbortController();
      const { agent } = session;

      const unsub = agent.subscribe((event: {
        type: string;
        assistantMessageEvent?: { type?: string; delta?: string };
        toolName?: string;
        message?: { role?: string; content?: unknown };
      }) => {
        if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
          conn.sessionUpdate({
            sessionId: params.sessionId,
            type: "text",
            textDelta: event.assistantMessageEvent.delta ?? "",
          }).catch(() => {});
        } else if (event.type === "tool_execution_start") {
          conn.sessionUpdate({
            sessionId: params.sessionId,
            type: "tool_use",
            toolName: event.toolName ?? "unknown",
          }).catch(() => {});
        }
      });

      try {
        await agent.prompt(promptText);

        const messages = agent.state.messages;
        const last = messages[messages.length - 1];
        let resultText = "";
        if (last?.role === "assistant" && Array.isArray(last.content)) {
          resultText = last.content
            .filter((b: { type?: string }) => b.type === "text")
            .map((b: { text?: string }) => b.text ?? "")
            .join("");
        }

        conn.sessionUpdate({
          sessionId: params.sessionId,
          type: "result",
          result: resultText,
        }).catch(() => {});

        return { stopReason: "end_turn" } as PromptResponse;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        conn.sessionUpdate({
          sessionId: params.sessionId,
          type: "error",
          error: message,
        }).catch(() => {});
        return { stopReason: "error" } as PromptResponse;
      } finally {
        unsub();
      }
    },

    cancel: async (params) => {
      const session = sessions.get(params.sessionId);
      if (session) {
        session.agent.abort();
      }
    },

    loadSession: async () => ({} as never),
    authenticate: async () => ({}),
    setSessionMode: async () => {},
    setSessionConfigOption: async () => ({} as never),
  };
}

const webWritable = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>;
const webReadable = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
const stream = ndJsonStream(webWritable, webReadable);

const _conn = new AgentSideConnection(
  (conn: AgentSideConnection): AcpAgent => buildAgentHandler(conn),
  stream,
);

process.on("SIGTERM", () => {
  for (const session of sessions.values()) {
    session.agent.abort();
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  for (const session of sessions.values()) {
    session.agent.abort();
  }
  process.exit(0);
});
