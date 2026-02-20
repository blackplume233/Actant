import { spawn } from "node:child_process";
import { createLogger } from "@agentcraft/shared";
import type {
  AgentCommunicator,
  PromptResult,
  RunPromptOptions,
  StreamChunk,
} from "./agent-communicator";

const logger = createLogger("claude-code-communicator");

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Communicates with an agent via the `claude` CLI in print mode.
 * Uses `claude -p --output-format stream-json "prompt"` for streaming
 * and `claude -p --output-format json "prompt"` for one-shot.
 */
export class ClaudeCodeCommunicator implements AgentCommunicator {
  private readonly executable: string;

  constructor(executable = "claude") {
    this.executable = executable;
  }

  async runPrompt(
    workspaceDir: string,
    prompt: string,
    options?: RunPromptOptions,
  ): Promise<PromptResult> {
    const args = this.buildArgs(prompt, options, "json");

    logger.debug({ workspaceDir, args }, "Running claude-code prompt");

    return new Promise<PromptResult>((resolve, reject) => {
      const child = spawn(this.executable, args, {
        cwd: workspaceDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Claude-code prompt timed out after ${timeout}ms`));
      }, timeout);

      child.on("close", (code) => {
        clearTimeout(timer);

        if (code !== 0) {
          logger.warn({ code, stderr: stderr.slice(0, 500) }, "claude-code exited with error");
          reject(new Error(`claude-code exited with code ${code}: ${stderr.slice(0, 500)}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as Record<string, unknown>;
          const result = parsed["result"] as string | undefined;
          const sessionId = parsed["session_id"] as string | undefined;
          const subtype = parsed["subtype"] as string | undefined;

          if (subtype && subtype !== "success") {
            logger.warn({ subtype }, "claude-code returned non-success subtype");
          }

          let text: string;
          if (result && result.length > 0) {
            text = result;
          } else if (subtype === "error_max_turns") {
            text = "[max turns reached — no final result text]";
          } else {
            text = stdout.trim();
          }

          resolve({ text, sessionId });
        } catch {
          resolve({ text: stdout.trim() });
        }
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn claude-code: ${err.message}`));
      });

      child.stdin.end();
    });
  }

  async *streamPrompt(
    workspaceDir: string,
    prompt: string,
    options?: RunPromptOptions,
  ): AsyncIterable<StreamChunk> {
    const args = this.buildArgs(prompt, options, "stream-json");

    logger.debug({ workspaceDir, args }, "Streaming claude-code prompt");

    const child = spawn(this.executable, args, {
      cwd: workspaceDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeout);

    child.stdin.end();

    let buffer = "";

    try {
      for await (const chunk of child.stdout) {
        buffer += (chunk as Buffer).toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed) as Record<string, unknown>;
            const streamChunk = parseStreamEvent(event);
            if (streamChunk) {
              yield streamChunk;
            }
          } catch {
            yield { type: "text", content: trimmed };
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as Record<string, unknown>;
          const streamChunk = parseStreamEvent(event);
          if (streamChunk) {
            yield streamChunk;
          }
        } catch {
          yield { type: "text", content: buffer.trim() };
        }
      }
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null) {
        child.kill("SIGTERM");
      }
    }
  }

  private buildArgs(
    prompt: string,
    options: RunPromptOptions | undefined,
    outputFormat: "json" | "stream-json",
  ): string[] {
    const args = ["-p", "--output-format", outputFormat];

    if (options?.systemPromptFile) {
      args.push("--system-prompt-file", options.systemPromptFile);
    }

    if (options?.appendSystemPrompt) {
      args.push("--append-system-prompt", options.appendSystemPrompt);
    }

    if (options?.sessionId) {
      args.push("--resume", options.sessionId);
    }

    if (options?.maxTurns !== undefined) {
      args.push("--max-turns", String(options.maxTurns));
    }

    if (options?.model) {
      args.push("--model", options.model);
    }

    args.push(prompt);
    return args;
  }
}

function parseStreamEvent(event: Record<string, unknown>): StreamChunk | null {
  const type = event["type"] as string | undefined;

  if (type === "assistant" || type === "text") {
    const message = event["message"] as string | undefined;
    const content = message ?? (event["content"] as string | undefined) ?? "";
    return { type: "text", content };
  }

  if (type === "tool_use") {
    const name = event["name"] as string | undefined;
    const input = event["input"] as unknown;
    return { type: "tool_use", content: name ? `[Tool: ${name}] ${JSON.stringify(input)}` : "" };
  }

  if (type === "result") {
    const result = event["result"] as string | undefined;
    return { type: "result", content: result ?? "" };
  }

  if (type === "error") {
    const error = event["error"] as { message?: string } | undefined;
    return { type: "error", content: error?.message ?? "Unknown error" };
  }

  // For unrecognized events, extract text content if available
  if (typeof event["content"] === "string") {
    return { type: "text", content: event["content"] };
  }

  return null;
}
