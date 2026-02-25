import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { Command } from "commander";
import chalk from "chalk";
import type { LaunchMode, WorkDirConflict } from "@actant/shared";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatAgentDetail, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

const VALID_LAUNCH_MODES = new Set(["direct", "acp-background", "acp-service", "one-shot"]);

function askQuestion(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim().toLowerCase());
    });
  });
}

export function createAgentCreateCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("create")
    .description("Create a new agent from a template")
    .argument("<name>", "Agent instance name")
    .requiredOption("-t, --template <template>", "Template name to use")
    .option("--launch-mode <mode>", "Launch mode: direct, acp-background, acp-service, one-shot")
    .option("--work-dir <path>", "Custom workspace directory (absolute or relative path)")
    .option("--workspace <path>", "Same as --work-dir: create instance at external path instead of builtin location")
    .option("--overwrite", "If instance directory exists, remove it and recreate")
    .option("--append", "If work-dir exists, add agent files into it")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: {
      template: string;
      launchMode?: string;
      workDir?: string;
      workspace?: string;
      overwrite?: boolean;
      append?: boolean;
      format: OutputFormat;
    }) => {
      try {
        if (opts.launchMode && !VALID_LAUNCH_MODES.has(opts.launchMode)) {
          printer.error(`${chalk.red(`Invalid launch mode: ${opts.launchMode}`)}`);
          process.exitCode = 1;
          return;
        }

        if (opts.overwrite && opts.append) {
          printer.error(`${chalk.red("Cannot use both --overwrite and --append")}`);
          process.exitCode = 1;
          return;
        }

        let workDirConflict: WorkDirConflict | undefined;
        const workDirPath = opts.workspace ?? opts.workDir;
        const workDir = workDirPath ? resolve(workDirPath) : undefined;

        if (opts.overwrite) {
          workDirConflict = "overwrite";
        } else if (opts.append) {
          workDirConflict = "append";
        } else if (workDir && existsSync(workDir)) {
          printer.warn(`Directory already exists: ${workDir}`);
          const answer = await askQuestion(
            `  ${chalk.yellow("(o)")}verwrite / ${chalk.cyan("(a)")}ppend / ${chalk.dim("(c)")}ancel? `,
          );
          if (answer === "o" || answer === "overwrite") {
            workDirConflict = "overwrite";
          } else if (answer === "a" || answer === "append") {
            workDirConflict = "append";
          } else {
            printer.log("Cancelled.");
            return;
          }
        }

        const overrides: Record<string, unknown> = {};
        if (opts.launchMode) overrides.launchMode = opts.launchMode as LaunchMode;
        if (workDir) overrides.workDir = workDir;
        if (workDirConflict) overrides.workDirConflict = workDirConflict;

        const meta = await client.call("agent.create", {
          name,
          template: opts.template,
          overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        });
        printer.log(`${chalk.green("Agent created successfully.")}\n`);
        printer.log(formatAgentDetail(meta, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
