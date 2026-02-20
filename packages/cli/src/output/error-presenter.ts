import chalk from "chalk";
import { AgentCraftError } from "@agentcraft/shared";
import { RpcCallError, ConnectionError } from "../client/rpc-client";
import { type CliPrinter, defaultPrinter } from "./printer";

export function presentError(err: unknown, printer: CliPrinter = defaultPrinter): void {
  if (err instanceof ConnectionError) {
    printer.errorStyled("Cannot connect to daemon.");
    printer.errorDim("Start with: agentcraft daemon start");
    return;
  }

  if (err instanceof RpcCallError) {
    printer.error(`${chalk.red(`[RPC ${err.code}]`)} ${err.message}`);
    if (err.data && typeof err.data === "object") {
      const data = err.data as Record<string, unknown>;
      if (data.context) {
        printer.error(`${chalk.dim("  Context:")} ${JSON.stringify(data.context)}`);
      }
    }
    return;
  }

  if (err instanceof AgentCraftError) {
    printer.error(`${chalk.red(`[${err.code}]`)} ${err.message}`);
    if (err.context && Object.keys(err.context).length > 0) {
      printer.error(`${chalk.dim("  Context:")} ${JSON.stringify(err.context)}`);
    }
    return;
  }

  if (err instanceof Error) {
    printer.error(`${chalk.red("Error:")} ${err.message}`);
  } else {
    printer.error(`${chalk.red("Error:")} ${String(err)}`);
  }
}
