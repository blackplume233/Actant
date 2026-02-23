import { Command } from "commander";
import chalk from "chalk";
import { getDefaultIpcPath } from "@actant/shared";
import { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";
import {
  chooseHome,
  configureProvider,
  configureSource,
  materializeAgent,
  configureAutostart,
  helloWorld,
  configureUpdate,
} from "./steps/index";

export function createSetupCommand(printer: CliPrinter = defaultPrinter): Command {
  return new Command("setup")
    .description("Interactive setup wizard — configure Actant step by step")
    .option("--skip-home", "Skip work directory selection")
    .option("--skip-provider", "Skip model provider configuration")
    .option("--skip-source", "Skip component source configuration")
    .option("--skip-agent", "Skip agent creation")
    .option("--skip-autostart", "Skip auto-start configuration")
    .option("--skip-hello", "Skip hello world verification")
    .option("--skip-update", "Skip update options")
    .action(async (opts: {
      skipHome?: boolean;
      skipProvider?: boolean;
      skipSource?: boolean;
      skipAgent?: boolean;
      skipAutostart?: boolean;
      skipHello?: boolean;
      skipUpdate?: boolean;
    }) => {
      try {
        printBanner(printer);

        // Step 1: Choose ACTANT_HOME
        let actantHome: string;
        if (opts.skipHome) {
          const { homedir } = await import("node:os");
          const { join } = await import("node:path");
          actantHome = process.env["ACTANT_HOME"] || join(homedir(), ".actant");
          printer.dim(`  使用默认工作目录: ${actantHome}`);
        } else {
          actantHome = await chooseHome(printer);
        }

        // Step 2: Configure Model Provider
        if (!opts.skipProvider) {
          await configureProvider(printer, actantHome);
        }

        // Steps 3-6 need the daemon running
        const daemonNeeded = !opts.skipSource || !opts.skipAgent || !opts.skipHello;
        let client: RpcClient | undefined;
        let daemonStartedBySetup = false;

        if (daemonNeeded) {
          const socketPath = process.env["ACTANT_SOCKET"] ?? getDefaultIpcPath(actantHome);
          client = new RpcClient(socketPath);

          const alive = await client.ping();
          if (!alive) {
            printer.log(chalk.dim("\n  正在启动 Daemon..."));
            daemonStartedBySetup = await tryStartDaemon(printer, socketPath);
            if (!daemonStartedBySetup) {
              printer.warn("  ⚠ 无法自动启动 Daemon，跳过需要 Daemon 的步骤");
              printer.dim("  请手动运行: actant daemon start");
              client = undefined;
            }
          } else {
            printer.dim("\n  Daemon 已在运行中");
          }
        }

        // Step 3: Configure Source
        if (!opts.skipSource && client) {
          await configureSource(printer, client);
        }

        // Step 4: Materialize Agent
        let createdAgents: string[] = [];
        if (!opts.skipAgent && client) {
          createdAgents = await materializeAgent(printer, client);
        }

        // Step 5: Configure Auto-start
        if (!opts.skipAutostart) {
          await configureAutostart(printer);
        }

        // Step 6: Hello World Verification
        if (!opts.skipHello && client) {
          await helloWorld(printer, client, createdAgents);
        }

        // Step 7: Update Options
        if (!opts.skipUpdate) {
          await configureUpdate(printer, actantHome);
        }

        printSummary(printer, actantHome);
      } catch (err) {
        if (isUserCancellation(err)) {
          printer.log(chalk.dim("\n  已取消设置向导"));
          return;
        }
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}

function printBanner(printer: CliPrinter): void {
  printer.log("");
  printer.log(chalk.cyan("╔══════════════════════════════════════════════╗"));
  printer.log(chalk.cyan("║") + chalk.bold("   Actant Setup Wizard                       ") + chalk.cyan("║"));
  printer.log(chalk.cyan("║") + chalk.dim("   Build, manage, and compose AI agents       ") + chalk.cyan("║"));
  printer.log(chalk.cyan("╚══════════════════════════════════════════════╝"));
}

function printSummary(printer: CliPrinter, actantHome: string): void {
  printer.log("");
  printer.log(chalk.green("══════════════════════════════════════════════"));
  printer.log(chalk.green.bold("  Setup Complete!"));
  printer.log(chalk.green("══════════════════════════════════════════════"));
  printer.log("");
  printer.dim(`  工作目录: ${actantHome}`);
  printer.log("");
  printer.log("  快速开始:");
  printer.log(`    ${chalk.cyan("actant daemon start")}     启动 Daemon`);
  printer.log(`    ${chalk.cyan("actant template list")}    浏览模板`);
  printer.log(`    ${chalk.cyan("actant agent list")}       查看 Agent`);
  printer.log(`    ${chalk.cyan("actant agent chat <n>")}   与 Agent 对话`);
  printer.log(`    ${chalk.cyan("actant setup")}            重新运行此向导`);
  printer.log("");
  printer.dim("  更多帮助: actant help");
  printer.log("");
}

async function tryStartDaemon(printer: CliPrinter, socketPath: string): Promise<boolean> {
  try {
    const { fork, spawn } = await import("node:child_process");
    const { join } = await import("node:path");
    const { isWindows, isSingleExecutable } = await import("@actant/shared");

    let child;
    if (isSingleExecutable()) {
      child = spawn(process.execPath, ["--__actant-daemon"], {
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
        env: process.env,
      });
    } else {
      const daemonScript = join(import.meta.dirname, "..", "daemon-entry.js");
      child = isWindows()
        ? spawn(process.execPath, [daemonScript], {
            detached: true,
            stdio: ["ignore", "ignore", "ignore"],
            env: process.env,
          })
        : fork(daemonScript, [], {
            detached: true,
            stdio: ["ignore", "ignore", "ignore", "ipc"],
            env: process.env,
          });
    }

    if ("connected" in child && child.connected) child.disconnect();
    child.unref();

    const client = new RpcClient(socketPath);
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await client.ping()) {
        printer.success("  ✓ Daemon 已启动");
        return true;
      }
    }

    printer.warn("  ⚠ Daemon 进程已启动但未响应");
    return false;
  } catch (err) {
    printer.warn(`  ⚠ 启动 Daemon 失败: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function isUserCancellation(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes("User force closed") ||
      err.message.includes("prompt was canceled") ||
      err.name === "ExitPromptError";
  }
  return false;
}
