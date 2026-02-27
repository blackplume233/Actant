import { execFile } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { connect } from "node:net";
import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import { getModel, Type } from "@mariozechner/pi-ai";

const execFileAsync = promisify(execFile);

export interface PiAgentOptions {
  workspaceDir: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  /** Provider base URL (reserved for future use with custom endpoints). */
  baseUrl?: string;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  tools?: string[];
  /** Pre-built AgentTool instances to merge (e.g. internal tools from ToolRegistry). */
  extraTools?: AgentTool[];
  systemPrompt?: string;
}

const ALL_TOOLS = ["read_file", "write_file", "list_directory", "run_command"] as const;

function resolvePath(workspaceDir: string, path: string): string {
  const abs = resolve(workspaceDir, path);
  const base = resolve(workspaceDir);
  if (!abs.startsWith(base)) {
    throw new Error(`Path "${path}" resolves outside workspace`);
  }
  return abs;
}

function buildTools(workspaceDir: string, toolNames?: string[]): AgentTool[] {
  const enabled = toolNames && toolNames.length > 0 ? toolNames : [...ALL_TOOLS];
  const tools: AgentTool[] = [];

  if (enabled.includes("read_file")) {
    tools.push({
      name: "read_file",
      label: "Read File",
      description: "Read the contents of a file. Path is relative to workspace.",
      parameters: Type.Object({
        path: Type.String({ description: "File path relative to workspace" }),
      }),
      execute: (async (_toolCallId, params) => {
        const { path } = params as { path: string };
        const absPath = resolvePath(workspaceDir, path);
        const content = await readFile(absPath, "utf-8");
        return { content: [{ type: "text" as const, text: content }], details: undefined };
      }) as AgentTool["execute"],
    });
  }

  if (enabled.includes("write_file")) {
    tools.push({
      name: "write_file",
      label: "Write File",
      description: "Write content to a file. Path is relative to workspace.",
      parameters: Type.Object({
        path: Type.String({ description: "File path relative to workspace" }),
        content: Type.String({ description: "Content to write" }),
      }),
      execute: (async (_toolCallId, params) => {
        const { path, content } = params as { path: string; content: string };
        const absPath = resolvePath(workspaceDir, path);
        await writeFile(absPath, content, "utf-8");
        return { content: [{ type: "text" as const, text: `Wrote ${path}` }], details: undefined };
      }) as AgentTool["execute"],
    });
  }

  if (enabled.includes("list_directory")) {
    tools.push({
      name: "list_directory",
      label: "List Directory",
      description: "List files and directories. Path is relative to workspace.",
      parameters: Type.Object({
        path: Type.String({ description: "Directory path relative to workspace" }),
      }),
      execute: (async (_toolCallId, params) => {
        const { path } = params as { path: string };
        const absPath = resolvePath(workspaceDir, path);
        const entries = await readdir(absPath, { withFileTypes: true });
        const lines = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
        return { content: [{ type: "text" as const, text: lines.join("\n") }], details: undefined };
      }) as AgentTool["execute"],
    });
  }

  if (enabled.includes("run_command")) {
    tools.push({
      name: "run_command",
      label: "Run Command",
      description: "Execute a shell command. command is the executable, args are the arguments.",
      parameters: Type.Object({
        command: Type.String({ description: "Executable to run" }),
        args: Type.Optional(Type.Array(Type.String(), { description: "Command arguments" })),
      }),
      execute: (async (_toolCallId, params, signal) => {
        const { command, args: argList } = params as { command: string; args?: string[] };
        const args = argList ?? [];
        const { stdout, stderr } = await execFileAsync(
          command,
          args,
          { cwd: workspaceDir, signal, encoding: "utf-8" },
        );
        const out = [stdout, stderr].filter(Boolean).join("\n").trim() || "(no output)";
        return { content: [{ type: "text" as const, text: out }], details: undefined };
      }) as AgentTool["execute"],
    });
  }

  return tools;
}

interface InternalToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  rpcMethod: string;
}

/**
 * Map a public rpcMethod (e.g. "canvas.update") to the token-authenticated
 * internal handler (e.g. "internal.canvasUpdate").
 */
function toInternalRpcMethod(rpcMethod: string): string {
  const [namespace, action] = rpcMethod.split(".");
  if (!action) return `internal.${namespace}`;
  return `internal.${namespace}${action.charAt(0).toUpperCase()}${action.slice(1)}`;
}

/**
 * Build AgentTool wrappers for actant internal tools.
 * Each tool calls the Daemon RPC via Unix socket with token auth.
 */
export function buildInternalTools(
  socketPath: string,
  token: string,
  toolDefs: InternalToolDef[],
): AgentTool[] {
  return toolDefs.map((def) => ({
    name: def.name,
    label: def.description,
    description: def.description,
    parameters: Type.Object(
      Object.fromEntries(
        Object.entries(def.parameters ?? {}).map(([k, v]) => {
          const vObj = typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
          return [k, vObj.type === "string" ? Type.String({ description: k }) : Type.Unknown()];
        }),
      ),
    ),
    execute: (async (_toolCallId: string, params: Record<string, unknown>) => {
      const method = toInternalRpcMethod(def.rpcMethod);
      const result = await rpcCall(socketPath, method, { token, ...params });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        details: undefined,
      };
    }) as AgentTool["execute"],
  }));
}

const RPC_TIMEOUT_MS = 30_000;

function rpcCall(socketPath: string, method: string, params: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

    const MAX_BUFFER = 1024 * 1024;
    const socket = connect(socketPath);
    const reqId = Date.now();
    const req = JSON.stringify({ jsonrpc: "2.0", id: reqId, method, params }) + "\n";
    let buffer = "";

    const timer = setTimeout(() => {
      settle(() => {
        socket.destroy();
        reject(new Error(`RPC call to ${method} timed out after ${RPC_TIMEOUT_MS}ms`));
      });
    }, RPC_TIMEOUT_MS);

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.length > MAX_BUFFER) {
        clearTimeout(timer);
        socket.destroy();
        settle(() => reject(new Error("RPC response exceeded 1MB buffer limit")));
        return;
      }
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const resp = JSON.parse(trimmed);
          clearTimeout(timer);
          socket.destroy();
          settle(() => {
            if (resp.error) reject(new Error(resp.error.message ?? "RPC error"));
            else resolve(resp.result);
          });
          return;
        } catch { /* partial data, keep buffering */ }
      }
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      socket.destroy();
      settle(() => reject(err));
    });
    socket.write(req);
  });
}

export function createPiAgent(options: PiAgentOptions): Agent {
  const {
    workspaceDir,
    provider = "anthropic",
    model = "claude-sonnet-4-20250514",
    apiKey,
    thinkingLevel,
    tools: toolNames,
    extraTools,
    systemPrompt = "You are a helpful coding assistant. You have access to file and command tools.",
  } = options;

  const modelInstance = getModel(provider as never, model);

  const allTools = [
    ...buildTools(workspaceDir, toolNames),
    ...(extraTools ?? []),
  ];

  const agentOptions: Record<string, unknown> = {
    initialState: {
      systemPrompt,
      model: modelInstance,
      tools: allTools,
    },
  };

  if (thinkingLevel) {
    (agentOptions.initialState as Record<string, unknown>).thinkingLevel = thinkingLevel;
  }

  if (apiKey) {
    agentOptions.getApiKey = async () => apiKey;
  }

  return new Agent(agentOptions as ConstructorParameters<typeof Agent>[0]);
}
