import { Command } from "commander";
import { RpcClient } from "../../client/rpc-client";
import { defaultSocketPath } from "../../program";
import { type CliPrinter, defaultPrinter } from "../../output/index";

/**
 * `actant internal` — token-authenticated commands for managed agent processes.
 * These are NOT intended for direct user invocation.
 */
export function createInternalCommand(printer: CliPrinter = defaultPrinter): Command {
  const cmd = new Command("internal")
    .description("Internal tool commands (for managed agents, requires session token)");

  cmd.addCommand(createCanvasCommand(printer));

  return cmd;
}

function createCanvasCommand(printer: CliPrinter): Command {
  const canvas = new Command("canvas")
    .description("Canvas operations");

  canvas.addCommand(
    new Command("update")
      .description("Update the agent's live HTML canvas")
      .requiredOption("--token <token>", "Session token")
      .requiredOption("--html <html>", "HTML content to render")
      .option("--title <title>", "Optional canvas title")
      .action(async (opts: { token: string; html: string; title?: string }) => {
        const client = new RpcClient(process.env["ACTANT_SOCKET"] ?? defaultSocketPath());
        try {
          await client.call("internal.canvasUpdate", {
            token: opts.token,
            html: opts.html,
            title: opts.title,
          });
          printer.log(JSON.stringify({ ok: true }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          printer.error(message);
          process.exitCode = 1;
        }
      }),
  );

  canvas.addCommand(
    new Command("clear")
      .description("Clear the agent's live HTML canvas")
      .requiredOption("--token <token>", "Session token")
      .action(async (opts: { token: string }) => {
        const client = new RpcClient(process.env["ACTANT_SOCKET"] ?? defaultSocketPath());
        try {
          await client.call("internal.canvasClear", { token: opts.token });
          printer.log(JSON.stringify({ ok: true }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          printer.error(message);
          process.exitCode = 1;
        }
      }),
  );

  return canvas;
}
