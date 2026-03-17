import type {
  VfsSourceRegistration,
  VfsLifecycle,
  VfsHandlerMap,
  VfsFileContent,
  VfsEntry,
  VfsListOptions,
  VfsStatResult,
  AgentInstanceMeta,
} from "@actant/shared";

interface AgentManagerLike {
  listAgents(): AgentInstanceMeta[];
  getAgent(name: string): AgentInstanceMeta | undefined;
}

const AGENT_FILES = ["status.json"] as const;

/**
 * Read-only VFS source exposing agent instances managed by the daemon.
 *
 * Virtual file layout:
 *   /                         → list of agent names (directories)
 *   /_catalog.json             → summary of all agents
 *   /<name>/                   → single agent directory
 *   /<name>/status.json        → full AgentInstanceMeta (minus secrets)
 */
export function createAgentRegistrySource(
  agentManager: AgentManagerLike,
  mountPoint: string,
  lifecycle: VfsLifecycle,
): VfsSourceRegistration {
  const handlers: VfsHandlerMap = {};

  function parseAgentPath(filePath: string): { agentName: string; file: string } | null {
    const parts = filePath.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [agentName] = parts;
    if (!agentName) return null;
    return { agentName, file: parts.slice(1).join("/") };
  }

  function sanitizeMeta(meta: AgentInstanceMeta): Record<string, unknown> {
    const { backendConfig: _bc, providerConfig: _pc, effectivePermissions: _ep, ...safe } = meta;
    return safe;
  }

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const normalized = filePath.replace(/^\/+/, "");

    if (normalized === "_catalog.json") {
      const agents = agentManager.listAgents().map((a) => ({
        name: a.name,
        status: a.status,
        archetype: a.archetype,
        backendType: a.backendType,
        launchMode: a.launchMode,
        pid: a.pid,
      }));
      return { content: JSON.stringify(agents, null, 2), mimeType: "application/json" };
    }

    const parsed = parseAgentPath(normalized);
    if (!parsed) throw new Error(`Invalid agent path: ${filePath}`);

    const agent = agentManager.getAgent(parsed.agentName);
    if (!agent) throw new Error(`Agent not found: ${parsed.agentName}`);

    if (parsed.file === "status.json") {
      return { content: JSON.stringify(sanitizeMeta(agent), null, 2), mimeType: "application/json" };
    }

    throw new Error(`Unknown agent file: ${parsed.file}`);
  };

  handlers.list = async (dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    const normalized = (dirPath ?? "").replace(/^\/+/, "");

    if (!normalized) {
      const agents = agentManager.listAgents();
      const entries: VfsEntry[] = agents.map((a) => ({
        name: a.name,
        path: a.name,
        type: "directory" as const,
      }));
      entries.unshift({ name: "_catalog.json", path: "_catalog.json", type: "file" as const });
      return entries;
    }

    const [agentName] = normalized.split("/");
    if (!agentName) {
      throw new Error(`Invalid agent path: ${dirPath}`);
    }
    const agent = agentManager.getAgent(agentName);
    if (!agent) throw new Error(`Agent not found: ${agentName}`);

    return AGENT_FILES.map((f) => ({
      name: f,
      path: `${agentName}/${f}`,
      type: "file" as const,
    }));
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const normalized = filePath.replace(/^\/+/, "");
    const parsed = parseAgentPath(normalized);
    if (!parsed) {
      const agent = agentManager.getAgent(normalized);
      return { type: agent ? "directory" : "file", size: 0, mtime: new Date().toISOString() };
    }
    return { type: "file", size: 0, mtime: new Date().toISOString() };
  };

  return {
    name: "agents",
    mountPoint,
    sourceType: "component-source",
    lifecycle,
    metadata: { description: "Agent instances registry (read-only, virtual)", virtual: true },
    fileSchema: {},
    handlers,
  };
}
