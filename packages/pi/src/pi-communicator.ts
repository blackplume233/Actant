import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgentCommunicator,
  PromptResult,
  RunPromptOptions,
  StreamChunk,
} from "@actant/core";
import { createLogger } from "@actant/shared";
import { createPiAgent, type PiAgentOptions } from "./pi-tool-bridge";

const logger = createLogger("pi-communicator");

export interface PiCommunicatorConfig {
  provider?: string;
  model?: string;
  apiKey?: string;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  tools?: string[];
}

/**
 * Extract PiCommunicatorConfig from a template's backend.config record.
 * Falls back to ACTANT_* environment variables, then to pi-ai built-in env resolution.
 */
export function configFromBackend(backendConfig?: Record<string, unknown>): PiCommunicatorConfig {
  return {
    provider: asString(backendConfig?.["provider"]) ?? process.env["ACTANT_PROVIDER"],
    model: asString(backendConfig?.["model"]) ?? process.env["ACTANT_MODEL"],
    apiKey: asString(backendConfig?.["apiKey"]),
    thinkingLevel: asString(backendConfig?.["thinkingLevel"]) as PiCommunicatorConfig["thinkingLevel"] ?? (process.env["ACTANT_THINKING_LEVEL"] as PiCommunicatorConfig["thinkingLevel"]),
    tools: Array.isArray(backendConfig?.["tools"]) ? (backendConfig["tools"] as string[]) : undefined,
  };
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export class PiCommunicator implements AgentCommunicator {
  private readonly config: PiCommunicatorConfig;

  constructor(config: PiCommunicatorConfig = {}) {
    this.config = config;
  }

  async runPrompt(
    workspaceDir: string,
    prompt: string,
    options?: RunPromptOptions,
  ): Promise<PromptResult> {
    logger.debug({ workspaceDir }, "Running Pi prompt");
    const agent = await this.buildAgent(workspaceDir, options);
    let text = "";

    const unsub = agent.subscribe((event: { type: string; assistantMessageEvent?: { type?: string; delta?: string } }) => {
      if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
        text += event.assistantMessageEvent.delta ?? "";
      }
    });

    try {
      await agent.prompt(prompt);
      const messages = agent.state.messages;
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.content) {
        const fullText = last.content
          .filter((b): b is { type: "text"; text: string } => "type" in b && b.type === "text")
          .map((b) => b.text ?? "")
          .join("");
        text = fullText || text;
      }
      return { text, sessionId: agent.sessionId };
    } finally {
      unsub();
    }
  }

  async *streamPrompt(
    workspaceDir: string,
    prompt: string,
    options?: RunPromptOptions,
  ): AsyncIterable<StreamChunk> {
    logger.debug({ workspaceDir }, "Streaming Pi prompt");
    const agent = await this.buildAgent(workspaceDir, options);
    const queue: StreamChunk[] = [];
    let resolve: (() => void) | null = null;
    let done = false;
    let promptError: Error | null = null;

    const unsub = agent.subscribe((event: {
      type: string;
      assistantMessageEvent?: { type?: string; delta?: string };
      toolCallId?: string;
      toolName?: string;
      args?: unknown;
      result?: { content?: Array<{ text?: string }> };
    }) => {
      if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
        queue.push({ type: "text", content: event.assistantMessageEvent.delta ?? "" });
      } else if (event.type === "tool_execution_start") {
        const content = event.toolName
          ? `[Tool: ${event.toolName}] ${JSON.stringify(event.args ?? {})}`
          : "";
        queue.push({ type: "tool_use", content });
      } else if (event.type === "tool_execution_end") {
        const parts = event.result?.content ?? [];
        const text = parts
          .filter((p) => p.text)
          .map((p) => p.text)
          .join("");
        queue.push({ type: "result", content: text });
      } else if (event.type === "agent_end") {
        done = true;
      }
      if (resolve) {
        resolve();
        resolve = null;
      }
    });

    const promptPromise = agent
      .prompt(prompt)
      .then(() => {
        done = true;
        if (resolve) {
          resolve();
          resolve = null;
        }
      })
      .catch((err: unknown) => {
        promptError = err instanceof Error ? err : new Error(String(err));
        queue.push({ type: "error", content: promptError.message });
        done = true;
        if (resolve) {
          resolve();
          resolve = null;
        }
      });

    try {
      while (!done || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift() as StreamChunk;
        } else {
          await new Promise<void>((r) => {
            resolve = r;
          });
        }
      }
      await promptPromise;
      if (promptError) throw promptError;
    } finally {
      unsub();
    }
  }

  private async buildAgent(
    workspaceDir: string,
    options?: RunPromptOptions,
  ): Promise<ReturnType<typeof createPiAgent>> {
    let systemPrompt =
      "You are a helpful coding assistant. You have access to file and command tools.";

    if (options?.systemPromptFile) {
      const path = join(workspaceDir, options.systemPromptFile);
      systemPrompt = await readFile(path, "utf-8");
    }
    if (options?.appendSystemPrompt) {
      systemPrompt += "\n\n" + options.appendSystemPrompt;
    }

    const opts: PiAgentOptions = {
      workspaceDir,
      provider: this.config.provider,
      model: options?.model ?? this.config.model,
      apiKey: this.config.apiKey,
      thinkingLevel: this.config.thinkingLevel,
      tools: this.config.tools,
      systemPrompt,
    };

    const agent = createPiAgent(opts);
    if (options?.sessionId) {
      agent.sessionId = options.sessionId;
    }
    return agent;
  }
}
