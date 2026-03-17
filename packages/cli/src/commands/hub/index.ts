import { Command } from "commander";
import type { HubActivateResult, HubStatusResult, VfsGrepRpcResult, VfsListRpcResult, VfsReadResult } from "@actant/shared";
import type { RpcClient } from "../../client/rpc-client";
import { ensureDaemonRunning } from "../daemon/start";
import { presentError, type CliPrinter, defaultPrinter, type OutputFormat } from "../../output/index";

const HUB_ALIASES: Record<string, string> = {
  "/project": "/hub/project",
  "/workspace": "/hub/workspace",
  "/config": "/hub/config",
  "/skills": "/hub/skills",
  "/prompts": "/hub/prompts",
  "/mcp": "/hub/mcp",
  "/workflows": "/hub/workflows",
  "/templates": "/hub/templates",
};

export function createHubCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  const hub = new Command("hub").description("CLI-first project bootstrap hub");

  hub
    .command("status")
    .description("Ensure the current project is mounted and show hub status")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const started = await ensureHubActivated(client, process.cwd(), printer);
        const status = await client.call("hub.status", {}) as HubStatusResult;
        if (opts.format === "json") {
          printer.log(JSON.stringify({ daemonStarted: started, ...status }, null, 2));
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
        await ensureHubActivated(client, process.cwd(), printer);
        const result = await client.call("vfs.read", {
          path: resolveHubPath(path),
          startLine: opts.start,
          endLine: opts.end,
        }) as VfsReadResult;
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
        await ensureHubActivated(client, process.cwd(), printer);
        const entries = await client.call("vfs.list", {
          path: resolveHubPath(path ?? "."),
          recursive: opts.recursive,
          long: opts.long,
        }) as VfsListRpcResult;
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
        await ensureHubActivated(client, process.cwd(), printer);
        const result = await client.call("vfs.grep", {
          pattern,
          path: resolveHubPath(path ?? "."),
          caseInsensitive: opts.ignoreCase,
          maxResults: opts.max,
        }) as VfsGrepRpcResult;
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

async function ensureHubActivated(
  client: RpcClient,
  projectDir: string,
  printer: CliPrinter,
): Promise<boolean> {
  const running = await client.ping();
  let started = false;
  if (!running) {
    ({ started } = await ensureDaemonRunning("bootstrap"));
    if (started) {
      printer.dim("Started bootstrap host.");
    }
  }

  await client.call("hub.activate", { projectDir }) as HubActivateResult;
  return started;
}

function resolveHubPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  if (normalized === "." || normalized === "./" || normalized === "") {
    return "/hub/workspace";
  }

  const alias = Object.entries(HUB_ALIASES).find(([prefix]) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  if (alias) {
    const [from, to] = alias;
    return `${to}${normalized.slice(from.length)}`;
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  return `/hub/workspace/${normalized.replace(/^\.?\//, "")}`;
}
