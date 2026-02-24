import { spawn } from "node:child_process";
import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentOpenCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("open")
    .description("Open an agent's native TUI in the foreground (e.g. Claude Code, Cursor Agent)")
    .argument("<name>", "Agent name")
    .option("-t, --template <template>", "Template name (auto-creates instance if not found)")
    .option("--no-attach", "Skip registering the process with the daemon")
    .option("--auto-install", "Auto-install missing backend CLI dependencies")
    .option("--no-install", "Disable auto-install (only report errors)")
    .action(async (name: string, opts: { template?: string; attach: boolean; autoInstall?: boolean; install?: boolean }) => {
      let attached = false;
      try {
        const autoInstall = opts.autoInstall === true ? true : opts.install === false ? false : undefined;
        const result = await client.call("agent.open", {
          name,
          template: opts.template,
          autoInstall,
        });

        printer.log(`${chalk.green("Opening")} ${name} → ${[result.command, ...result.args].join(" ")}`);

        const spawnOpts = result.openSpawnOptions ?? {};
        const child = spawn(result.command, result.args, {
          cwd: result.cwd,
          ...spawnOpts,
          stdio: spawnOpts.stdio ?? "inherit",
          detached: spawnOpts.detached ?? false,
        });

        if (opts.attach && child.pid) {
          try {
            await client.call("agent.attach", { name, pid: child.pid });
            attached = true;
          } catch (attachErr) {
            printer.warn(`Warning: could not register process with daemon: ${(attachErr as Error).message}`);
          }
        }

        child.on("error", (err) => {
          printer.error(`Failed to open ${name}: ${err.message}`);
          process.exitCode = 1;
        });

        const code = await new Promise<number | null>((resolve) => child.on("close", resolve));

        if (attached) {
          try {
            await client.call("agent.detach", { name });
          } catch {
            // best-effort detach
          }
        }

        if (code) process.exitCode = code;
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
