import type {
  VfsFeature,
  VfsMountRegistration,
  VfsFileSchemaMap,
  VfsLifecycle,
  VfsHandlerMap,
  VfsFileContent,
  VfsEntry,
  VfsListOptions,
  VfsStatResult,
  VfsWriteResult,
} from "@actant/shared";

const MCP_CONFIG_TRAITS = new Set<VfsFeature>(["persistent", "writable"]);

interface McpConfigRecord {
  name: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpConfigManagerLike {
  list(): McpConfigRecord[];
  get(name: string): McpConfigRecord | undefined;
  add(config: McpConfigRecord, persist?: boolean): Promise<void>;
  update(name: string, patch: Partial<McpConfigRecord>, persist?: boolean): Promise<McpConfigRecord>;
}

const MCP_CONFIG_FILE_SCHEMA: VfsFileSchemaMap = {
  "_catalog.json": {
    type: "json",
    mimeType: "application/json",
    capabilities: ["read", "stat"],
  },
  "config": {
    type: "json",
    mimeType: "application/json",
    capabilities: ["read", "write", "stat"],
  },
};

function normalizePath(filePath: string): string {
  return filePath.replace(/^\/+/, "").replace(/\/+$/, "");
}

function resolveConfigName(filePath: string): string {
  const normalized = normalizePath(filePath);
  if (!normalized || normalized === "_catalog.json" || normalized.includes("/")) {
    throw new Error(`MCP config path not found: ${filePath}`);
  }
  return normalized.replace(/\.json$/i, "");
}

function parseConfigWrite(name: string, content: string, existing?: McpConfigRecord): McpConfigRecord {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Invalid MCP config payload for "${name}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  if (parsed == null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`Invalid MCP config payload for "${name}": payload must be a JSON object`);
  }
  if ("name" in parsed && parsed.name !== name) {
    throw new Error(`MCP config payload name "${String(parsed.name)}" does not match path "${name}"`);
  }
  if (typeof parsed.command !== "string" || parsed.command.trim().length === 0) {
    throw new Error(`Invalid MCP config payload for "${name}": "command" must be a non-empty string`);
  }

  return {
    name,
    description: typeof parsed.description === "string" ? parsed.description : existing?.description,
    command: parsed.command,
    args: Array.isArray(parsed.args) ? parsed.args as string[] : existing?.args,
    env: parsed.env != null && typeof parsed.env === "object" && !Array.isArray(parsed.env)
      ? parsed.env as Record<string, string>
      : existing?.env,
  };
}

export function createMcpConfigSource(
  manager: McpConfigManagerLike,
  mountPoint: string,
  lifecycle: VfsLifecycle,
): VfsMountRegistration {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const normalized = normalizePath(filePath);
    if (normalized === "_catalog.json") {
      const catalog = manager.list().map((config) => ({
        name: config.name,
        description: config.description,
        command: config.command,
        args: config.args ?? [],
      }));
      return {
        content: JSON.stringify(catalog, null, 2),
        mimeType: "application/json",
      };
    }

    const name = resolveConfigName(filePath);
    const config = manager.get(name);
    if (!config) {
      throw new Error(`MCP config not found: ${name}`);
    }

    return {
      content: JSON.stringify(config, null, 2),
      mimeType: "application/json",
    };
  };

  handlers.write = async (filePath: string, content: string): Promise<VfsWriteResult> => {
    const name = resolveConfigName(filePath);
    const existing = manager.get(name);
    const config = parseConfigWrite(name, content, existing);

    if (existing) {
      await manager.update(name, config, true);
    } else {
      await manager.add(config, true);
    }

    return {
      bytesWritten: Buffer.byteLength(content),
      created: existing == null,
    };
  };

  handlers.list = async (dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    const normalized = normalizePath(dirPath);
    if (normalized) {
      throw new Error(`MCP config path not found: ${dirPath}`);
    }

    const entries = manager.list().map((config) => ({
      name: config.name,
      path: config.name,
      type: "file" as const,
    }));
    entries.unshift({
      name: "_catalog.json",
      path: "_catalog.json",
      type: "file" as const,
    });
    return entries;
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const normalized = normalizePath(filePath);
    if (!normalized) {
      return { size: 0, type: "directory", mtime: new Date().toISOString() };
    }
    if (normalized === "_catalog.json") {
      return { size: 0, type: "file", mtime: new Date().toISOString(), mimeType: "application/json" };
    }

    const name = resolveConfigName(filePath);
    const config = manager.get(name);
    if (!config) {
      throw new Error(`MCP config not found: ${name}`);
    }

    return {
      size: Buffer.byteLength(JSON.stringify(config)),
      type: "file",
      mtime: new Date().toISOString(),
      mimeType: "application/json",
    };
  };

  return {
    name: "mcp-configs",
    mountPoint,
    label: "mcp-config",
    features: new Set(MCP_CONFIG_TRAITS),
    lifecycle,
    metadata: {
      description: "Built-in MCP config source",
      virtual: true,
      filesystemType: "hostfs",
      mountType: mountPoint === "/" ? "root" : "direct",
    },
    fileSchema: MCP_CONFIG_FILE_SCHEMA,
    handlers,
  };
}
