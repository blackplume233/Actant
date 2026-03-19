import {
  type VfsSourceRegistration,
  type VfsSourceFactory,
  type VfsSourceSpec,
  type VfsLifecycle,
  type VfsHandlerMap,
  type VfsFileContent,
  type VfsWriteResult,
  type VfsEntry,
  type VfsFileSchemaMap,
  type VfsGrepResult,
  type VfsGrepMatch,
  type VfsListOptions,
} from "@actant/shared";

type ProcessSpec = Extract<VfsSourceSpec, { type: "process" }>;

/**
 * Ring buffer that stores process output lines with a configurable capacity.
 */
class OutputBuffer {
  private lines: string[] = [];
  private maxLines: number;

  constructor(maxLines = 10000) {
    this.maxLines = maxLines;
  }

  append(data: string): void {
    const newLines = data.split("\n");
    this.lines.push(...newLines);
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(this.lines.length - this.maxLines);
    }
  }

  getAll(): string {
    return this.lines.join("\n");
  }

  getRange(startLine: number, endLine?: number): string {
    const start = startLine < 0
      ? Math.max(0, this.lines.length + startLine)
      : startLine - 1;
    const end = endLine ?? this.lines.length;
    return this.lines.slice(start, end).join("\n");
  }

  search(pattern: RegExp): VfsGrepMatch[] {
    const matches: VfsGrepMatch[] = [];
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i] ?? "";
      if (pattern.test(line)) {
        matches.push({ path: "stdout", line: i + 1, content: line });
        pattern.lastIndex = 0;
      }
    }
    return matches;
  }

  get lineCount(): number {
    return this.lines.length;
  }
}

export interface ProcessHandle {
  pid: number;
  command?: string;
  args?: string[];
  status: "running" | "stopped" | "exited";
  exitCode?: number;
  startedAt: number;
  stdout: OutputBuffer;
  stderr: OutputBuffer;
  env?: Record<string, string>;
  config?: Record<string, unknown>;
  onCommand?: (cmd: string) => Promise<void>;
  onStdin?: (data: string) => Promise<void>;
}

const PROC_FILE_SCHEMA: VfsFileSchemaMap = {
  status: { type: "text", capabilities: ["read"], dynamic: true },
  pid: { type: "text", capabilities: ["read"] },
  stdout: { type: "stream", capabilities: ["read", "read_range", "grep"], dynamic: true },
  stderr: { type: "stream", capabilities: ["read", "read_range", "grep"], dynamic: true },
  cmd: {
    type: "control",
    capabilities: ["write"],
    description: "Write control instructions: stop / restart / signal <SIG>",
  },
  stdin: { type: "control", capabilities: ["write"] },
  "config.json": { type: "json", capabilities: ["read", "write", "edit"] },
  "env.json": { type: "json", capabilities: ["read"] },
  "metrics.json": { type: "json", capabilities: ["read"], dynamic: true },
};

function createHandlers(handle: ProcessHandle): VfsHandlerMap {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    switch (filePath) {
      case "status":
        return {
          content: JSON.stringify({
            pid: handle.pid,
            status: handle.status,
            exitCode: handle.exitCode,
            startedAt: new Date(handle.startedAt).toISOString(),
            command: handle.command,
            uptime: handle.status === "running" ? Date.now() - handle.startedAt : undefined,
          }),
          mimeType: "application/json",
        };
      case "pid":
        return { content: String(handle.pid) };
      case "stdout":
        return { content: handle.stdout.getAll() };
      case "stderr":
        return { content: handle.stderr.getAll() };
      case "config.json":
        return {
          content: JSON.stringify(handle.config ?? {}, null, 2),
          mimeType: "application/json",
        };
      case "env.json":
        return {
          content: JSON.stringify(handle.env ?? {}, null, 2),
          mimeType: "application/json",
        };
      case "metrics.json":
        return {
          content: JSON.stringify({
            stdoutLines: handle.stdout.lineCount,
            stderrLines: handle.stderr.lineCount,
            uptimeMs: handle.status === "running" ? Date.now() - handle.startedAt : 0,
          }),
          mimeType: "application/json",
        };
      default:
        throw new Error(`Unknown process file: ${filePath}`);
    }
  };

  handlers.read_range = async (
    filePath: string,
    startLine: number,
    endLine?: number,
  ): Promise<VfsFileContent> => {
    const buffer = filePath === "stderr" ? handle.stderr : handle.stdout;
    return { content: buffer.getRange(startLine, endLine) };
  };

  handlers.write = async (filePath: string, content: string): Promise<VfsWriteResult> => {
    switch (filePath) {
      case "cmd":
        if (handle.onCommand) {
          await handle.onCommand(content.trim());
        }
        return { bytesWritten: Buffer.byteLength(content), created: false };
      case "stdin":
        if (handle.onStdin) {
          await handle.onStdin(content);
        }
        return { bytesWritten: Buffer.byteLength(content), created: false };
      case "config.json":
        handle.config = JSON.parse(content);
        return { bytesWritten: Buffer.byteLength(content), created: false };
      default:
        throw new Error(`Cannot write to: ${filePath}`);
    }
  };

  handlers.list = async (_dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    return Object.keys(PROC_FILE_SCHEMA).map((name) => ({
      name,
      path: name,
      type: "file" as const,
    }));
  };

  handlers.grep = async (pattern: string): Promise<VfsGrepResult> => {
    const regex = new RegExp(pattern, "g");
    const stdoutMatches = handle.stdout.search(regex);
    regex.lastIndex = 0;
    const stderrMatches = handle.stderr
      .search(regex)
      .map((m) => ({ ...m, path: "stderr" }));

    const matches = [...stdoutMatches, ...stderrMatches];
    return { matches, totalMatches: matches.length, truncated: false };
  };

  return handlers;
}

/**
 * Creates a VfsSourceRegistration for a managed process.
 * The caller provides a ProcessHandle with output buffers and control callbacks.
 */
export function createProcessSource(
  name: string,
  mountPoint: string,
  handle: ProcessHandle,
  lifecycle: VfsLifecycle,
): VfsSourceRegistration {
  return {
    name,
    mountPoint,
    sourceType: "process",
    lifecycle,
    metadata: {
      description: `Process: ${handle.command ?? "unknown"} (PID: ${handle.pid})`,
      virtual: true,
      owner: mountPoint.split("/")[2],
    },
    fileSchema: PROC_FILE_SCHEMA,
    handlers: createHandlers(handle),
  };
}

export const processSourceFactory: VfsSourceFactory<ProcessSpec> = {
  type: "process",

  validate(spec: ProcessSpec) {
    if (!spec.pid && !spec.command) {
      return { valid: false, errors: ["Either pid or command is required"] };
    }
    return { valid: true };
  },

  create(spec: ProcessSpec, mountPoint: string, lifecycle: VfsLifecycle): VfsSourceRegistration {
    const bufferSize = spec.bufferSize ?? 10000;
    const handle: ProcessHandle = {
      pid: spec.pid ?? 0,
      command: spec.command,
      args: spec.args,
      status: "running",
      startedAt: Date.now(),
      stdout: new OutputBuffer(bufferSize),
      stderr: new OutputBuffer(bufferSize),
    };

    return createProcessSource("", mountPoint, handle, lifecycle);
  },
};

export { OutputBuffer };
