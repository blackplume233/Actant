import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createSourceAddCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("add")
    .description("Register a component source")
    .argument("<url-or-path>", "GitHub URL or local directory path")
    .requiredOption("--name <name>", "Package name (namespace prefix)")
    .option("--type <type>", "Source type: github, local, community", "github")
    .option("--branch <branch>", "Git branch (for github/community type)", "main")
    .option("--filter <glob>", "Glob pattern to filter skills (community type only)")
    .action(async (urlOrPath: string, opts: { name: string; type: string; branch: string; filter?: string }) => {
      try {
        let config;
        if (opts.type === "local") {
          config = { type: "local" as const, path: urlOrPath };
        } else if (opts.type === "community") {
          config = {
            type: "community" as const,
            url: urlOrPath,
            branch: opts.branch,
            filter: opts.filter,
          };
        } else {
          config = { type: "github" as const, url: urlOrPath, branch: opts.branch };
        }
        const result = await client.call("source.add", { name: opts.name, config });
        const c = result.components;
        printer.success(
          `Source "${opts.name}" added. Components: ${c.skills} skills, ${c.prompts} prompts, ${c.mcp} mcp, ${c.workflows} workflows, ${c.presets} presets`,
        );
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
