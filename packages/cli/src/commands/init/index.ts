import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import type { ActantNamespaceConfig } from "@actant/shared";
import { defaultPrinter, type CliPrinter, presentError } from "../../output/index";

type InitScaffold = "minimal" | "standard";

export function createInitCommand(printer: CliPrinter = defaultPrinter): Command {
  return new Command("init")
    .description("Create an actant.namespace.json scaffold in the current directory")
    .option("--scaffold <type>", "Scaffold type: standard or minimal")
    .action(async (opts: { scaffold?: string }) => {
      try {
        const scaffold = await resolveScaffold(opts.scaffold, printer);
        await materializeNamespaceScaffold(process.cwd(), scaffold);
        printer.success(`Created actant.namespace.json (${scaffold})`);
        printer.log(`Project root: ${process.cwd()}`);
      } catch (error) {
        presentError(error, printer);
        process.exitCode = 1;
      }
    });
}

async function resolveScaffold(input: string | undefined, printer: CliPrinter): Promise<InitScaffold> {
  if (input === "minimal" || input === "standard") {
    return input;
  }

  printer.log("Select scaffold:");
  printer.log("  1. standard (default) — /workspace + /config + /agents + /mcp/runtime");
  printer.log("  2. minimal            — /workspace + /config");

  const answer = await prompt("Scaffold [1/2] (default 1): ");
  if (answer.trim() === "2" || answer.trim().toLowerCase() === "minimal") {
    return "minimal";
  }
  return "standard";
}

async function prompt(question: string): Promise<string> {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

async function materializeNamespaceScaffold(projectRoot: string, scaffold: InitScaffold): Promise<void> {
  const configPath = join(projectRoot, "actant.namespace.json");
  const config = buildNamespaceConfig(scaffold);

  await mkdir(join(projectRoot, "configs"), { recursive: true });
  await mkdir(join(projectRoot, "configs", "skills"), { recursive: true });
  await mkdir(join(projectRoot, "configs", "prompts"), { recursive: true });
  await mkdir(join(projectRoot, "configs", "mcp"), { recursive: true });
  await mkdir(join(projectRoot, "configs", "workflows"), { recursive: true });
  await mkdir(join(projectRoot, "configs", "templates"), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function buildNamespaceConfig(scaffold: InitScaffold): ActantNamespaceConfig {
  const mounts: ActantNamespaceConfig["mounts"] = [
    {
      type: "hostfs",
      path: "/workspace",
      options: { hostPath: "." },
    },
    {
      type: "hostfs",
      path: "/config",
      options: { hostPath: "configs" },
    },
  ];

  if (scaffold === "standard") {
    mounts.push(
      { type: "runtimefs", path: "/agents" },
      { type: "runtimefs", path: "/mcp/runtime" },
    );
  }

  return {
    version: 1,
    mounts,
  };
}
