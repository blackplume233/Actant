import { Command } from "commander";
import {
  VfsRegistry,
  createDaemonInfoSource,
} from "@actant/agent-runtime";
import {
  createProjectContextSourceTypeRegistry,
  createProjectContextRegistrations,
  loadProjectContext,
} from "@actant/api";
import type {
  HubActivateResult,
  HubStatusResult,
  VfsGrepRpcResult,
  VfsListRpcResult,
  VfsReadResult,
} from "@actant/shared";
import { getBridgeSessionToken, HUB_MOUNT_LAYOUT, mapHubPath } from "@actant/shared";
import type { RpcClient } from "../../client/rpc-client";
import { ensureDaemonRunning } from "../daemon/start";
import { presentError, type CliPrinter, defaultPrinter, type OutputFormat } from "../../output/index";

interface HubBackend {
  readonly mode: "connected" | "standalone";
  readonly status: HubStatusResult;
  read(path: string, startLine?: number, endLine?: number): Promise<VfsReadResult>;
  list(path?: string, recursive?: boolean, long?: boolean): Promise<VfsListRpcResult>;
  grep(
    pattern: string,
    path?: string,
    caseInsensitive?: boolean,
    maxResults?: number,
  ): Promise<VfsGrepRpcResult>;
}

interface HubCommandDependencies {
  ensureDaemonRunningImpl?: typeof ensureDaemonRunning;
  createStandaloneBackend?: (projectDir: string) => Promise<HubBackend>;
}

export function createHubCommand(
  client: RpcClient,
  printer: CliPrinter = defaultPrinter,
  dependencies?: HubCommandDependencies,
): Command {
  const hub = new Command("hub").description("CLI-first project context hub");
  const ensureDaemonRunningImpl = dependencies?.ensureDaemonRunningImpl ?? ensureDaemonRunning;
  const createStandaloneBackend = dependencies?.createStandaloneBackend ?? createStandaloneHubBackend;

  hub
    .command("status")
    .description("Ensure the current project is mounted and show hub status")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const backend = await resolveHubBackend(client, process.cwd(), printer, ensureDaemonRunningImpl, createStandaloneBackend);
        const status = backend.status;
        if (opts.format === "json") {
          printer.log(JSON.stringify({ daemonStarted: backend.mode === "connected", ...status }, null, 2));
          return;
        }
        if (opts.format === "quiet") {
          printer.log(status.active ? "ready" : "inactive");
          return;
        }

        printer.log(`Host Profile: ${status.hostProfile}`);
        printer.log(`Runtime:      ${status.runtimeState}`);
        printer.log(`Project:      ${status.projectName ?? "(inactive)"}`);
        if (status.projectRoot) printer.log(`Root:         ${status.projectRoot}`);
        if (status.configPath) printer.log(`Config:       ${status.configPath}`);
        printer.log(`Workspace:    ${status.mounts.workspace}`);
        if (status.sourceWarnings?.length) {
          printer.dim(`Warnings:     ${status.sourceWarnings.length}`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  hub
    .command("read <path>")
    .description("Read a project-context path from the hub")
    .option("--start <n>", "Start line", parseInt)
    .option("--end <n>", "End line", parseInt)
    .option("--json", "Output as JSON")
    .action(async (path: string, opts: { start?: number; end?: number; json?: boolean }) => {
      try {
        const backend = await resolveHubBackend(client, process.cwd(), printer, ensureDaemonRunningImpl, createStandaloneBackend);
        const result = await backend.read(resolveHubPath(path), opts.start, opts.end);
        printer.log(opts.json ? JSON.stringify(result, null, 2) : result.content);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  hub
    .command("list [path]")
    .alias("ls")
    .description("List files or virtual mounts from the hub")
    .option("-r, --recursive", "List recursively")
    .option("-l, --long", "Include size and mtime")
    .option("--json", "Output as JSON")
    .action(async (path: string | undefined, opts: { recursive?: boolean; long?: boolean; json?: boolean }) => {
      try {
        const backend = await resolveHubBackend(client, process.cwd(), printer, ensureDaemonRunningImpl, createStandaloneBackend);
        const entries = await backend.list(resolveHubPath(path ?? "."), opts.recursive, opts.long);
        if (opts.json) {
          printer.log(JSON.stringify(entries, null, 2));
          return;
        }
        for (const entry of entries) {
          const suffix = entry.type === "directory" ? "/" : "";
          const size = opts.long && entry.size != null ? `  ${entry.size}B` : "";
          const mtime = opts.long && entry.mtime ? `  ${entry.mtime}` : "";
          printer.log(`${entry.path}${suffix}${size}${mtime}`);
        }
        if (entries.length === 0) {
          printer.dim("(empty)");
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  hub
    .command("grep <pattern> [path]")
    .description("Search the current project context through hub VFS")
    .option("-i, --ignore-case", "Case insensitive")
    .option("--max <n>", "Max results", parseInt)
    .option("--json", "Output as JSON")
    .action(async (pattern: string, path: string | undefined, opts: { ignoreCase?: boolean; max?: number; json?: boolean }) => {
      try {
        const backend = await resolveHubBackend(client, process.cwd(), printer, ensureDaemonRunningImpl, createStandaloneBackend);
        const result = await backend.grep(pattern, resolveHubPath(path ?? "."), opts.ignoreCase, opts.max);
        if (opts.json) {
          printer.log(JSON.stringify(result, null, 2));
          return;
        }
        for (const match of result.matches) {
          printer.log(`${match.path}:${match.line}: ${match.content}`);
        }
        if (result.matches.length === 0) {
          printer.dim("(no matches)");
        } else if (result.truncated) {
          printer.dim(`(showing ${result.matches.length} of ${result.totalMatches}+ matches)`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  return hub;
}

async function resolveHubBackend(
  client: RpcClient,
  projectDir: string,
  printer: CliPrinter,
  ensureDaemonRunningImpl: typeof ensureDaemonRunning,
  createStandaloneBackend: (projectDir: string) => Promise<HubBackend>,
): Promise<HubBackend> {
  const running = await client.ping();
  if (running) {
    return createConnectedHubBackend(client, projectDir);
  }

  try {
    const { started } = await ensureDaemonRunningImpl("context");
    if (started) {
      printer.dim("Started context host.");
    }
    return createConnectedHubBackend(client, projectDir);
  } catch (err) {
    if (!canUseStandaloneFallback(err)) {
      throw err;
    }
    printer.dim("Daemon unavailable, using standalone project-context mode.");
    return createStandaloneBackend(projectDir);
  }
}

async function createConnectedHubBackend(client: RpcClient, projectDir: string): Promise<HubBackend> {
  const sessionToken = getBridgeSessionToken();
  await client.call("hub.activate", { projectDir }) as HubActivateResult;
  const status = await client.call("hub.status", {}) as HubStatusResult;
  return {
    mode: "connected",
    status,
    read(path, startLine, endLine) {
      return client.call("vfs.read", { path, startLine, endLine, token: sessionToken }) as Promise<VfsReadResult>;
    },
    list(path = "/hub/workspace", recursive, long) {
      return client.call("vfs.list", { path, recursive, long, token: sessionToken }) as Promise<VfsListRpcResult>;
    },
    grep(pattern, path = "/hub/workspace", caseInsensitive, maxResults) {
      return client.call("vfs.grep", { pattern, path, caseInsensitive, maxResults, token: sessionToken }) as Promise<VfsGrepRpcResult>;
    },
  };
}

async function createStandaloneHubBackend(projectDir: string): Promise<HubBackend> {
  const context = await loadProjectContext(projectDir);
  const registry = new VfsRegistry();
  const factoryRegistry = createProjectContextSourceTypeRegistry();

  for (const registration of createProjectContextRegistrations(
    context,
    factoryRegistry,
    HUB_MOUNT_LAYOUT,
    { type: "daemon" },
    {
      namePrefix: "standalone-hub",
      workspaceReadOnly: true,
      configReadOnly: true,
    },
  )) {
    registry.mount(registration);
  }

  registry.mount(createDaemonInfoSource({
    getVersion: () => "standalone",
    getUptime: () => 0,
    getAgentCount: () => 0,
    getRpcMethods: () => [],
    getHostProfile: () => "context",
    getRuntimeState: () => "inactive",
    getCapabilities: () => ["hub", "vfs", "domain"],
    getHubProject: () => ({
      projectRoot: context.projectRoot,
      projectName: context.summary.projectName,
      configPath: context.configPath,
    }),
  }, "/daemon", { type: "daemon" }));

  return {
    mode: "standalone",
    status: {
      active: true,
      hostProfile: "context",
      runtimeState: "inactive",
      projectRoot: context.projectRoot,
      projectName: context.summary.projectName,
      configPath: context.configPath,
      configsDir: context.configsDir,
      sourceWarnings: context.summary.sourceWarnings,
      components: context.summary.components,
      mounts: HUB_MOUNT_LAYOUT,
    },
    async read(path, startLine, endLine) {
      const resolved = registry.resolve(path);
      if (!resolved) {
        throw new Error(`VFS path not found: ${path}`);
      }

      if (startLine != null) {
        const handler = requireHandler(resolved.source.handlers.read_range, "read_range", path);
        const result = await handler(resolved.relativePath, startLine, endLine);
        return { content: result.content, mimeType: result.mimeType };
      }

      const handler = requireHandler(resolved.source.handlers.read, "read", path);
      const result = await handler(resolved.relativePath);
      return { content: result.content, mimeType: result.mimeType };
    },
    async list(path = "/hub/workspace", recursive, long) {
      const resolved = registry.resolve(path);
      if (!resolved) {
        const childMounts = registry.listChildMounts(path);
        return childMounts.map((source) => ({
          name: source.mountPoint.split("/").pop() ?? source.name,
          path: source.mountPoint,
          type: "directory" as const,
        }));
      }
      const handler = requireHandler(resolved.source.handlers.list, "list", path);
      const entries = await handler(resolved.relativePath, { recursive, long });
      if (resolved.relativePath !== "") {
        return entries;
      }

      const childMounts = registry.listChildMounts(path);
      const projectedMounts = childMounts.map((source) => ({
        name: source.mountPoint.split("/").pop() ?? source.name,
        path: source.mountPoint,
        type: "directory" as const,
      }));
      const deduped = new Map<string, (typeof entries)[number]>();
      for (const entry of [...entries, ...projectedMounts]) {
        deduped.set(entry.path, entry);
      }
      return [...deduped.values()];
    },
    async grep(pattern, path = "/hub/workspace", caseInsensitive, maxResults) {
      const resolved = registry.resolve(path);
      if (!resolved) {
        throw new Error(`VFS path not found: ${path}`);
      }
      const handler = requireHandler(resolved.source.handlers.grep, "grep", path);
      return handler(pattern, { caseInsensitive, maxResults });
    },
  };
}

function canUseStandaloneFallback(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /listen\s+(?:eperm|eacces)|operation not permitted|permission denied/i.test(message);
}

function requireHandler<T>(handler: T | undefined | null, capability: string, path: string): T {
  if (!handler) {
    throw new Error(`Capability "${capability}" not supported for path "${path}"`);
  }
  return handler;
}

function resolveHubPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  if (normalized === "." || normalized === "./" || normalized === "") {
    return "/hub/workspace";
  }

  const mapped = mapHubPath(normalized);
  if (mapped !== normalized) {
    return mapped;
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  return `/hub/workspace/${normalized.replace(/^\.?\//, "")}`;
}
