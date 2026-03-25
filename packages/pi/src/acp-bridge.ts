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
import { getBridgeSocketPath, getBridgeSessionToken, bridgeLogger } from "@actant/shared";
import { createPiAgent, buildInternalTools, type PiAgentOptions } from "./pi-tool-bridge";
import { getPiPackageVersion } from "./package-version";

interface SessionState {
  agent: PiAgent;
  cwd: string;
  abortController: AbortController;
  lastActiveAt: number;
}

const sessions = new Map<string, SessionState>();
let sessionCounter = 0;

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes idle TTL
const SESSION_SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_SESSIONS = 100;

const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, state] of sessions) {
    if (now - state.lastActiveAt > SESSION_TTL_MS) {
      state.agent.abort();
      sessions.delete(id);
    }
  }
}, SESSION_SWEEP_INTERVAL_MS);
sweepTimer.unref();

function buildAgentHandler(conn: AgentSideConnection): AcpAgent {
  return {
    initialize: async (_params): Promise<InitializeResponse> => {
      return {
        protocolVersion: 1,
        agentCapabilities: {},
        agentInfo: {
          name: "pi-acp-bridge",
          version: getPiPackageVersion(),
        },
      } as InitializeResponse;
    },

    newSession: async (params): Promise<NewSessionResponse> => {
      const sessionId = `pi-session-${++sessionCounter}`;
      const cwd = params.cwd ?? process.cwd();

      let systemPrompt = "You are a helpful coding assistant. You have access to file and command tools.";
      const systemCtxEnv = process.env["ACTANT_SYSTEM_CONTEXT"];
      if (systemCtxEnv) {
        systemPrompt += "\n\n" + systemCtxEnv;
      }

      const agentOpts: PiAgentOptions = {
        workspaceDir: cwd,
        provider: process.env["ACTANT_PROVIDER"] ?? "anthropic",
        model: process.env["ACTANT_MODEL"] ?? "claude-sonnet-4-20250514",
        apiKey: process.env["ACTANT_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"] ?? process.env["OPENAI_API_KEY"],
        baseUrl: process.env["ACTANT_BASE_URL"] ?? undefined,
        thinkingLevel: (process.env["ACTANT_THINKING_LEVEL"] as PiAgentOptions["thinkingLevel"]) ?? undefined,
        systemPrompt,
      };

      // Inject internal tools from ToolRegistry via env
      const socketPath = getBridgeSocketPath();
      const sessionToken = getBridgeSessionToken();
      const toolsJson = process.env["ACTANT_TOOLS"];
      if (socketPath && sessionToken && toolsJson) {
        try {
          const toolDefs = JSON.parse(toolsJson);
          const internalTools = buildInternalTools(socketPath, sessionToken, toolDefs);
          agentOpts.extraTools = internalTools;
        } catch (err) {
          bridgeLogger.error("Failed to parse ACTANT_TOOLS", err);
        }
      }

      if (sessions.size >= MAX_SESSIONS) {
        let oldestId: string | undefined;
        let oldestTime = Infinity;
        for (const [id, s] of sessions) {
          if (s.lastActiveAt < oldestTime) {
            oldestTime = s.lastActiveAt;
            oldestId = id;
          }
        }
        if (oldestId) {
          sessions.get(oldestId)?.agent.abort();
          sessions.delete(oldestId);
        }
      }

      const agent = createPiAgent(agentOpts);
      sessions.set(sessionId, {
        agent,
        cwd,
        abortController: new AbortController(),
        lastActiveAt: Date.now(),
      });

      return { sessionId } as NewSessionResponse;
    },

    prompt: async (params): Promise<PromptResponse> => {
      const session = sessions.get(params.sessionId);
      if (!session) {
        throw new Error(`Session "${params.sessionId}" not found`);
      }
      session.lastActiveAt = Date.now();

      const promptText = params.prompt
        ?.filter((b) => b.type === "text")
        .map((b) => ("text" in b ? (b as { text: string }).text : ""))
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
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: event.assistantMessageEvent.delta ?? "" },
            },
          } as never).catch(() => {});
        } else if (event.type === "tool_execution_start") {
          conn.sessionUpdate({
            sessionId: params.sessionId,
            update: {
              sessionUpdate: "tool_call",
              content: { type: "text", text: `[Tool: ${event.toolName ?? "unknown"}]` },
            },
          } as never).catch(() => {});
        }
      });

      try {
        await agent.prompt(promptText);
        return { stopReason: "end_turn" } as PromptResponse;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        conn.sessionUpdate({
          sessionId: params.sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: `[Error] ${message}` },
          },
        } as never).catch(() => {});
        return { stopReason: "end_turn" } as PromptResponse;
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

new AgentSideConnection(
  (conn: AgentSideConnection): AcpAgent => buildAgentHandler(conn),
  stream,
);

function gracefulShutdown(): void {
  clearInterval(sweepTimer);
  for (const session of sessions.values()) {
    session.agent.abort();
  }
  sessions.clear();
  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
