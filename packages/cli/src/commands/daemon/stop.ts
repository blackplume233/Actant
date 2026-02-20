import { Command } from "commander";
import { RpcClient } from "../../client/rpc-client";
import { type CliPrinter, defaultPrinter } from "../../output/index";
import { defaultSocketPath } from "../../program";

export function createDaemonStopCommand(printer: CliPrinter = defaultPrinter): Command {
  return new Command("stop")
    .description("Stop the AgentCraft daemon")
    .action(async () => {
      const client = new RpcClient(defaultSocketPath());

      try {
        await client.call("daemon.shutdown", {});
        printer.success("Daemon stopping...");
      } catch {
        printer.warn("Daemon is not running.");
      }
    });
}
