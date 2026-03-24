import { Command } from "commander";
import type {
  HubActivateResult,
  HubStatusResult,
  VfsGrepRpcResult,
  VfsListRpcResult,
  VfsReadResult,
} from "@actant/shared";
import { getBridgeSessionToken, mapHubPath } from "@actant/shared";
import type { RpcClient } from "../../client/rpc-client";
import { ensureDaemonRunning } from "../daemon/start";
import { presentError, type CliPrinter, defaultPrinter, type OutputFormat } from "../../output/index";

interface HubBackend {
  readonly mode: "connected";
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
}

export function createHubCommand(
  client: RpcClient,
  printer: CliPrinter = defaultPrinter,
  dependencies?: HubCommandDependencies,
): Command {
  const hub = new Command("hub").description("CLI-first namespace hub");
  const ensureDaemonRunningImpl = dependencies?.ensureDaemonRunningImpl ?? ensureDaemonRunning;

  hub
    .command("status")
    .description("Ensure the current project is mounted and show hub status")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const backend = await resolveHubBackend(client, process.cwd(), printer, ensureDaemonRunningImpl);
        const status = backend.status;
        if (opts.format === "json") {
          printer.log(JSON.stringify({ daemonStarted: true, ...status }, null, 2));
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
        if (status.catalogWarnings?.length) {
          printer.dim(`Warnings:     ${status.catalogWarnings.length}`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  hub
    .command("read <path>")
    .description("Read a namespace path from the hub")
    .option("--start <n>", "Start line", parseInt)
    .option("--end <n>", "End line", parseInt)
    .option("--json", "Output as JSON")
    .action(async (path: string, opts: { start?: number; end?: number; json?: boolean }) => {
      try {
        const backend = await resolveHubBackend(client, process.cwd(), printer, ensureDaemonRunningImpl);
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
        const backend = await resolveHubBackend(client, process.cwd(), printer, ensureDaemonRunningImpl);
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
    .description("Search the active namespace through hub VFS")
    .option("-i, --ignore-case", "Case insensitive")
    .option("--max <n>", "Max results", parseInt)
    .option("--json", "Output as JSON")
    .action(async (pattern: string, path: string | undefined, opts: { ignoreCase?: boolean; max?: number; json?: boolean }) => {
      try {
        const backend = await resolveHubBackend(client, process.cwd(), printer, ensureDaemonRunningImpl);
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
): Promise<HubBackend> {
  const running = await client.ping();
  if (!running) {
    try {
      const { started } = await ensureDaemonRunningImpl("context");
      if (started) {
        printer.dim("Started context host.");
      }
    } catch (err) {
      throw wrapDaemonHostRequirement(err);
    }
  }

  return createConnectedHubBackend(client, projectDir);
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

function wrapDaemonHostRequirement(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  return new Error(
    `Hub bridge requires the daemon RPC host. Standalone namespace mode is no longer supported. ${message}`,
  );
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
