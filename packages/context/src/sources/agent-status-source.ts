import type {
  SourceTrait,
  VfsSourceRegistration,
  VfsLifecycle,
  VfsFileContent,
  VfsEntry,
  VfsStatResult,
} from "@actant/shared";
import type { ContextSource, ContextSourceType } from "../types";

const AGENT_STATUS_TRAITS = new Set<SourceTrait>(["ephemeral", "virtual"]);

/**
 * Minimal agent info required for VFS projection.
 * Kept lightweight so @actant/context doesn't depend on @actant/agent-runtime types.
 */
export interface AgentStatusInfo {
  name: string;
  description?: string;
  archetype: string;
  status: string;
  startedAt?: string;
  toolSchema?: Record<string, unknown>;
}

/**
 * Provider interface for getting runtime agent status.
 * Implemented by the agent management layer (AgentManager or AgentServer).
 */
export interface AgentStatusProvider {
  listAgents(): AgentStatusInfo[];
  getAgent(name: string): AgentStatusInfo | undefined;
}

/**
 * A ContextSource that projects Internal Agent status and tool schemas
 * into VFS, so both External and Internal Agents can discover available
 * Agent-as-tool capabilities.
 *
 * VFS layout:
 * ```
 * /agents/
 * ├── _catalog.json            → all agents: name, description, status
 * ├── code-reviewer/
 * │   ├── status.json          → { name, archetype, status, startedAt }
 * │   └── tool-schema.json     → input JSON Schema (if toolSchema defined)
 * └── asset-query/
 *     ├── status.json
 *     └── tool-schema.json
 * ```
 */
export class AgentStatusSource implements ContextSource {
  readonly name = "agent-status";
  readonly type: ContextSourceType = "agent";

  constructor(
    private readonly provider: AgentStatusProvider,
    private readonly lifecycle: VfsLifecycle = { type: "daemon" },
  ) {}

  toVfsMounts(mountPrefix: string): VfsSourceRegistration[] {
    const prefix = mountPrefix || "";
    const mountPoint = `${prefix}/agents`;

    return [
      {
        name: "agent-status",
        mountPoint,
        label: "agent-status",
        traits: new Set(AGENT_STATUS_TRAITS),
        lifecycle: this.lifecycle,
        metadata: { description: "Internal Agent status and tool schemas", virtual: true },
        fileSchema: {},
        handlers: {
          read: async (filePath: string): Promise<VfsFileContent> => {
            const normalized = filePath.replace(/^\/+/, "");

            if (normalized === "_catalog.json") {
              const agents = this.provider.listAgents();
              const catalog = agents.map((a) => ({
                name: a.name,
                description: a.description,
                archetype: a.archetype,
                status: a.status,
              }));
              return { content: JSON.stringify(catalog, null, 2), mimeType: "application/json" };
            }

            const parts = normalized.split("/");
            const agentName = parts[0];
            const file = parts[1];

            if (!agentName) throw new Error("Agent name required");
            const agent = this.provider.getAgent(agentName);
            if (!agent) throw new Error(`Agent not found: ${agentName}`);

            if (file === "status.json" || !file) {
              const status = {
                name: agent.name,
                description: agent.description,
                archetype: agent.archetype,
                status: agent.status,
                startedAt: agent.startedAt,
              };
              return { content: JSON.stringify(status, null, 2), mimeType: "application/json" };
            }

            if (file === "tool-schema.json") {
              if (!agent.toolSchema) {
                throw new Error(`Agent "${agentName}" does not expose a tool schema`);
              }
              const schema = {
                name: `actant_${agent.name}`,
                description: agent.description,
                inputSchema: agent.toolSchema,
              };
              return { content: JSON.stringify(schema, null, 2), mimeType: "application/json" };
            }

            throw new Error(`Unknown file: ${normalized}`);
          },

          list: async (dirPath: string): Promise<VfsEntry[]> => {
            const normalized = dirPath.replace(/^\/+/, "").replace(/\/+$/, "");

            if (normalized === "" || normalized === ".") {
              const agents = this.provider.listAgents();
              const entries: VfsEntry[] = [
                { name: "_catalog.json", path: "_catalog.json", type: "file" },
              ];
              for (const agent of agents) {
                entries.push({ name: agent.name, path: agent.name, type: "directory" });
              }
              return entries;
            }

            const agent = this.provider.getAgent(normalized);
            if (!agent) throw new Error(`Agent not found: ${normalized}`);

            const entries: VfsEntry[] = [
              { name: "status.json", path: `${normalized}/status.json`, type: "file" },
            ];
            if (agent.toolSchema) {
              entries.push({
                name: "tool-schema.json",
                path: `${normalized}/tool-schema.json`,
                type: "file",
              });
            }
            return entries;
          },

          stat: async (filePath: string): Promise<VfsStatResult> => {
            const normalized = filePath.replace(/^\/+/, "");
            return {
              size: 0,
              type: normalized.includes(".") ? "file" : "directory",
              mtime: new Date().toISOString(),
            };
          },
        },
      },
    ];
  }
}
