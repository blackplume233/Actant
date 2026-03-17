import type {
  VfsSourceRegistration,
  VfsLifecycle,
  VfsHandlerMap,
  VfsFileContent,
  VfsEntry,
  VfsListOptions,
  VfsStatResult,
} from "@actant/shared";

interface DaemonInfoProvider {
  getVersion(): string;
  getUptime(): number;
  getAgentCount(): number;
  getRpcMethods(): string[];
}

/**
 * Read-only VFS source exposing daemon metadata and RPC catalog.
 *
 * Virtual file layout:
 *   /                    → list of virtual files
 *   /health.json          → version, uptime, agent count
 *   /rpc-catalog.json     → grouped list of all available RPC methods
 */
export function createDaemonInfoSource(
  provider: DaemonInfoProvider,
  mountPoint: string,
  lifecycle: VfsLifecycle,
): VfsSourceRegistration {
  const handlers: VfsHandlerMap = {};

  const VIRTUAL_FILES = ["health.json", "rpc-catalog.json"] as const;

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const normalized = filePath.replace(/^\/+/, "");

    if (normalized === "health.json") {
      const data = {
        version: provider.getVersion(),
        uptimeSeconds: Math.round(provider.getUptime() / 1000),
        agentCount: provider.getAgentCount(),
        timestamp: new Date().toISOString(),
      };
      return { content: JSON.stringify(data, null, 2), mimeType: "application/json" };
    }

    if (normalized === "rpc-catalog.json") {
      const methods = provider.getRpcMethods();
      const grouped: Record<string, string[]> = {};
      for (const m of methods) {
        const d = m.split(".")[0] ?? "other";
        let bucket = grouped[d];
        if (!bucket) {
          bucket = [];
          grouped[d] = bucket;
        }
        bucket.push(m);
      }
      return { content: JSON.stringify(grouped, null, 2), mimeType: "application/json" };
    }

    throw new Error(`Unknown daemon file: ${filePath}`);
  };

  handlers.list = async (_dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    return VIRTUAL_FILES.map((f) => ({ name: f, path: f, type: "file" as const }));
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const normalized = filePath.replace(/^\/+/, "");
    if (VIRTUAL_FILES.includes(normalized as typeof VIRTUAL_FILES[number])) {
      return { type: "file", size: 0, mtime: new Date().toISOString() };
    }
    throw new Error(`Unknown daemon file: ${filePath}`);
  };

  return {
    name: "daemon",
    mountPoint,
    sourceType: "component-source",
    lifecycle,
    metadata: { description: "Daemon health & RPC catalog (read-only, virtual)", virtual: true },
    fileSchema: {},
    handlers,
  };
}
