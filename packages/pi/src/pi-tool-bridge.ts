import { execFile } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import { getModel, Type } from "@mariozechner/pi-ai";

const execFileAsync = promisify(execFile);

export interface PiAgentOptions {
  workspaceDir: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  tools?: string[];
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

export function createPiAgent(options: PiAgentOptions): Agent {
  const {
    workspaceDir,
    provider = "anthropic",
    model = "claude-sonnet-4-20250514",
    apiKey,
    thinkingLevel,
    tools: toolNames,
    systemPrompt = "You are a helpful coding assistant. You have access to file and command tools.",
  } = options;

  const modelInstance = getModel(provider as never, model);

  const agentOptions: Record<string, unknown> = {
    initialState: {
      systemPrompt,
      model: modelInstance,
      tools: buildTools(workspaceDir, toolNames),
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
