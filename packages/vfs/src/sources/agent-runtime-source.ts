import type {
  AgentInstanceMeta,
  VfsFileContent,
  VfsEntry,
  VfsFileSchemaMap,
  VfsHandlerMap,
  VfsLifecycle,
  VfsListOptions,
  VfsSourceRegistration,
  VfsStatResult,
  VfsStreamChunk,
  VfsWatchEvent,
  VfsWatchOptions,
  VfsWriteResult,
} from "@actant/shared";

export interface AgentControlRequest {
  prompt: string;
  sessionId?: string;
}

export interface AgentRuntimeWatchEvent {
  type: "create" | "modify" | "delete";
  agentName?: string;
  timestamp?: number;
}

export interface AgentRuntimeSourceProvider {
  listAgents(): AgentInstanceMeta[];
  getAgent(name: string): AgentInstanceMeta | undefined;
  readStream?(
    name: string,
    stream: "stdout" | "stderr",
  ): Promise<VfsFileContent> | VfsFileContent;
  stream?(
    name: string,
    stream: "stdout" | "stderr",
  ): Promise<AsyncIterable<VfsStreamChunk>> | AsyncIterable<VfsStreamChunk>;
  writeControl?(
    name: string,
    controlPath: "request.json",
    content: string,
  ): Promise<VfsWriteResult>;
  subscribe?(listener: (event: AgentRuntimeWatchEvent) => void): () => void;
}

const AGENT_RUNTIME_FILE_SCHEMA: VfsFileSchemaMap = {
  "_catalog.json": {
    type: "json",
    mimeType: "application/json",
    capabilities: ["read", "stat"],
  },
  "status.json": {
    type: "json",
    mimeType: "application/json",
    capabilities: ["read", "stat"],
  },
  "streams": {
    type: "directory",
    capabilities: ["list", "stat"],
  },
  "stdout": {
    type: "stream",
    mimeType: "text/plain",
    capabilities: ["read", "stream", "stat"],
  },
  "stderr": {
    type: "stream",
    mimeType: "text/plain",
    capabilities: ["read", "stream", "stat"],
  },
  "control": {
    type: "directory",
    capabilities: ["list", "stat"],
  },
  "request.json": {
    type: "control",
    mimeType: "application/json",
    capabilities: ["read", "write", "stat"],
  },
};

type ParsedAgentPath =
  | { kind: "root" }
  | { kind: "catalog" }
  | { kind: "agent"; agentName: string }
  | { kind: "status"; agentName: string }
  | { kind: "streams"; agentName: string }
  | { kind: "stream"; agentName: string; streamName: string }
  | { kind: "control"; agentName: string }
  | { kind: "request"; agentName: string };

function normalizePath(filePath: string): string {
  return filePath.replace(/^\/+/, "").replace(/\/+$/, "");
}

function parseAgentPath(filePath: string): ParsedAgentPath {
  const normalized = normalizePath(filePath);
  if (!normalized) {
    return { kind: "root" };
  }
  if (normalized === "_catalog.json") {
    return { kind: "catalog" };
  }

  const parts = normalized.split("/");
  const agentName = parts[0];
  if (!agentName) {
    throw new Error(`Agent path not found: ${filePath}`);
  }

  if (parts.length === 1) {
    return { kind: "agent", agentName };
  }
  if (parts.length === 2 && parts[1] === "status.json") {
    return { kind: "status", agentName };
  }
  if (parts.length === 2 && parts[1] === "streams") {
    return { kind: "streams", agentName };
  }
  if (parts.length === 3 && parts[1] === "streams") {
    return { kind: "stream", agentName, streamName: parts[2] ?? "" };
  }
  if (parts.length === 2 && parts[1] === "control") {
    return { kind: "control", agentName };
  }
  if (parts.length === 3 && parts[1] === "control" && parts[2] === "request.json") {
    return { kind: "request", agentName };
  }

  throw new Error(`Agent path not found: ${filePath}`);
}

function requireAgent(
  provider: AgentRuntimeSourceProvider,
  agentName: string,
): AgentInstanceMeta {
  const agent = provider.getAgent(agentName);
  if (!agent) {
    throw new Error(`Agent not found: ${agentName}`);
  }
  return agent;
}

function parseAgentControlRequest(agentName: string, content: string): AgentControlRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid control request for agent "${agentName}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  if (parsed == null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`Invalid control request for agent "${agentName}": payload must be a JSON object`);
  }

  const request = parsed as Record<string, unknown>;
  if (typeof request.prompt !== "string" || request.prompt.trim().length === 0) {
    throw new Error(`Invalid control request for agent "${agentName}": "prompt" must be a non-empty string`);
  }

  const sessionId = request.sessionId;
  if (sessionId != null && typeof sessionId !== "string") {
    throw new Error(`Invalid control request for agent "${agentName}": "sessionId" must be a string`);
  }

  return {
    prompt: request.prompt,
    sessionId: typeof sessionId === "string" ? sessionId : undefined,
  };
}

function toCatalogEntry(agent: AgentInstanceMeta): Record<string, unknown> {
  return {
    name: agent.name,
    templateName: agent.templateName,
    status: agent.status,
    archetype: agent.archetype,
    startedAt: agent.startedAt,
  };
}

function matchesWatchTarget(requestedPath: string, eventPath: string): boolean {
  const normalizedRequested = normalizePath(requestedPath);
  if (!normalizedRequested) {
    return true;
  }
  return eventPath === normalizedRequested || eventPath.startsWith(`${normalizedRequested}/`);
}

function eventPathsForAgentEvent(event: AgentRuntimeWatchEvent): string[] {
  const agentName = event.agentName;
  if (!agentName) {
    return ["status.json"];
  }
  if (event.type === "create" || event.type === "delete") {
    return [agentName, `${agentName}/status.json`];
  }
  return [`${agentName}/status.json`];
}

async function* oneShotStream(content: VfsFileContent): AsyncGenerator<VfsStreamChunk> {
  if (content.content.length === 0) {
    return;
  }
  yield {
    content: content.content,
    mimeType: content.mimeType,
    encoding: content.encoding,
    timestamp: Date.now(),
  };
}

export function createAgentRuntimeSource(
  provider: AgentRuntimeSourceProvider,
  mountPoint: string,
  lifecycle: VfsLifecycle,
): VfsSourceRegistration {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const parsed = parseAgentPath(filePath);

    if (parsed.kind === "catalog") {
      return {
        content: JSON.stringify(provider.listAgents().map(toCatalogEntry), null, 2),
        mimeType: "application/json",
      };
    }

    if (parsed.kind === "status") {
      return {
        content: JSON.stringify(requireAgent(provider, parsed.agentName), null, 2),
        mimeType: "application/json",
      };
    }

    if (parsed.kind === "stream") {
      requireAgent(provider, parsed.agentName);
      const streamName = requireAgentStream(parsed.streamName);
      if (provider.readStream) {
        return provider.readStream(parsed.agentName, streamName);
      }
      return { content: "", mimeType: "text/plain" };
    }

    if (parsed.kind === "request") {
      requireAgent(provider, parsed.agentName);
      return {
        content: "{}",
        mimeType: "application/json",
      };
    }

    throw new Error(`Agent path not readable: ${filePath}`);
  };

  handlers.write = async (filePath: string, content: string): Promise<VfsWriteResult> => {
    const parsed = parseAgentPath(filePath);
    if (parsed.kind !== "request") {
      throw new Error(`Agent path is not writable: ${filePath}`);
    }

    requireAgent(provider, parsed.agentName);
    parseAgentControlRequest(parsed.agentName, content);

    if (!provider.writeControl) {
      throw new Error(`Capability "write" not supported for path "${parsed.agentName}/control/request.json"`);
    }

    return provider.writeControl(parsed.agentName, "request.json", content);
  };

  handlers.list = async (dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    const parsed = parseAgentPath(dirPath);

    if (parsed.kind === "root") {
      const entries: VfsEntry[] = provider.listAgents().map((agent) => ({
        name: agent.name,
        path: agent.name,
        type: "directory" as const,
      }));
      entries.unshift({
        name: "_catalog.json",
        path: "_catalog.json",
        type: "file",
      });
      return entries;
    }

    if (parsed.kind === "agent") {
      requireAgent(provider, parsed.agentName);
      return [
        { name: "status.json", path: `${parsed.agentName}/status.json`, type: "file" },
        { name: "streams", path: `${parsed.agentName}/streams`, type: "directory" },
        { name: "control", path: `${parsed.agentName}/control`, type: "directory" },
      ];
    }

    if (parsed.kind === "streams") {
      requireAgent(provider, parsed.agentName);
      return [
        { name: "stdout", path: `${parsed.agentName}/streams/stdout`, type: "file" },
        { name: "stderr", path: `${parsed.agentName}/streams/stderr`, type: "file" },
      ];
    }

    if (parsed.kind === "control") {
      requireAgent(provider, parsed.agentName);
      return [
        { name: "request.json", path: `${parsed.agentName}/control/request.json`, type: "file" },
      ];
    }

    throw new Error(`Agent path not listable: ${dirPath}`);
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const parsed = parseAgentPath(filePath);
    if (parsed.kind === "root" || parsed.kind === "agent" || parsed.kind === "streams" || parsed.kind === "control") {
      return { size: 0, type: "directory", mtime: new Date().toISOString() };
    }
    if (parsed.kind === "catalog") {
      return { size: 0, type: "file", mtime: new Date().toISOString(), mimeType: "application/json" };
    }
    if (parsed.kind === "status") {
      const agent = requireAgent(provider, parsed.agentName);
      return {
        size: Buffer.byteLength(JSON.stringify(agent)),
        type: "file",
        mtime: agent.updatedAt,
        mimeType: "application/json",
      };
    }

    requireAgent(provider, parsed.agentName);
    if (parsed.kind === "stream") {
      requireAgentStream(parsed.streamName);
    }
    return {
      size: 0,
      type: "file",
      mtime: new Date().toISOString(),
      mimeType: parsed.kind === "stream" ? "text/plain" : "application/json",
    };
  };

  handlers.watch = (
    pattern: string,
    callback: (event: VfsWatchEvent) => void,
    opts?: VfsWatchOptions,
  ) => {
    if (!provider.subscribe) {
      return () => undefined;
    }

    return provider.subscribe((event) => {
      if (opts?.events && !opts.events.includes(event.type)) {
        return;
      }
      for (const eventPath of eventPathsForAgentEvent(event)) {
        if (!matchesWatchTarget(pattern, eventPath)) {
          continue;
        }
        callback({
          type: event.type,
          path: eventPath,
          timestamp: event.timestamp ?? Date.now(),
        });
      }
    });
  };

  handlers.stream = async (filePath: string): Promise<AsyncIterable<VfsStreamChunk>> => {
    const parsed = parseAgentPath(filePath);
    if (parsed.kind !== "stream") {
      throw new Error(`Stream not found: ${filePath}`);
    }

    requireAgent(provider, parsed.agentName);
    const streamName = requireAgentStream(parsed.streamName);

    if (provider.stream) {
      return provider.stream(parsed.agentName, streamName);
    }
    if (provider.readStream) {
      const content = await provider.readStream(parsed.agentName, streamName);
      return oneShotStream(content);
    }

    return oneShotStream({ content: "", mimeType: "text/plain" });
  };

  return {
    name: "agents",
    mountPoint,
    sourceType: "component-source",
    lifecycle,
    metadata: { description: "Built-in agent runtime source", virtual: true },
    fileSchema: AGENT_RUNTIME_FILE_SCHEMA,
    handlers,
  };
}
function requireAgentStream(streamName: string): "stdout" | "stderr" {
  if (streamName !== "stdout" && streamName !== "stderr") {
    throw new Error(`Stream not found: ${streamName}`);
  }
  return streamName;
}
