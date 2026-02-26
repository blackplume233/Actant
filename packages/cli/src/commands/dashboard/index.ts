import { Command } from "commander";
import { defaultSocketPath } from "../../program";
import type { CliPrinter } from "../../output/index";
import { defaultPrinter } from "../../output/index";

export function createDashboardCommand(printer: CliPrinter = defaultPrinter): Command {
  return new Command("dashboard")
    .description("Open the web dashboard for monitoring agents")
    .option("-p, --port <port>", "Port to run the dashboard server on", "3200")
    .option("--no-open", "Do not automatically open the browser")
    .action(async (opts: { port: string; open: boolean }) => {
      const port = Number(opts.port);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        printer.error(`Invalid port: ${opts.port}`);
        process.exitCode = 1;
        return;
      }

      try {
        const { startDashboard } = await import("@actant/dashboard");
        await startDashboard({
          port,
          socketPath: defaultSocketPath(),
          open: opts.open,
        });
      } catch (err) {
        printer.error(`Failed to start dashboard: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}
