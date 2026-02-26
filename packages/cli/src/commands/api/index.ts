import { Command } from "commander";
import { defaultSocketPath } from "../../program";
import type { CliPrinter } from "../../output/index";
import { defaultPrinter } from "../../output/index";

export function createApiCommand(printer: CliPrinter = defaultPrinter): Command {
  return new Command("api")
    .description("Start the standalone REST API server for external integrations (n8n, IM, etc.)")
    .option("-p, --port <port>", "Port to listen on", "3100")
    .option("-H, --host <host>", "Host to bind to", "0.0.0.0")
    .option("-k, --api-key <key>", "Require API key for authentication (also reads ACTANT_API_KEY env)")
    .action(async (opts: { port: string; host: string; apiKey?: string }) => {
      const port = Number(opts.port);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        printer.error(`Invalid port: ${opts.port}`);
        process.exitCode = 1;
        return;
      }

      const apiKey = opts.apiKey ?? process.env["ACTANT_API_KEY"];

      try {
        const { startApiServer } = await import("@actant/rest-api");
        await startApiServer({
          port,
          host: opts.host,
          socketPath: defaultSocketPath(),
          apiKey,
        });
        // Keep alive
        await new Promise(() => {});
      } catch (err) {
        printer.error(`Failed to start API server: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}
