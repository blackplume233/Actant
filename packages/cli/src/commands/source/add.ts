import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createSourceAddCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("add")
    .description("Register a component source")
    .argument("<url-or-path>", "GitHub URL or local directory path")
    .requiredOption("--name <name>", "Package name (namespace prefix)")
    .option("--type <type>", "Source type: github, local", "github")
    .option("--branch <branch>", "Git branch (for github type)", "main")
    .action(async (urlOrPath: string, opts: { name: string; type: string; branch: string }) => {
      try {
        const config = opts.type === "local"
          ? { type: "local" as const, path: urlOrPath }
          : { type: "github" as const, url: urlOrPath, branch: opts.branch };
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
