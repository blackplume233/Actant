import chalk from "chalk";
import { AgentCraftError } from "@agentcraft/shared";
import { RpcCallError, ConnectionError } from "../client/rpc-client";

export function presentError(err: unknown): void {
  if (err instanceof ConnectionError) {
    console.error(chalk.red("Cannot connect to daemon."));
    console.error(chalk.dim("Start with: agentcraft daemon start"));
    return;
  }

  if (err instanceof RpcCallError) {
    console.error(chalk.red(`[RPC ${err.code}]`), err.message);
    if (err.data && typeof err.data === "object") {
      const data = err.data as Record<string, unknown>;
      if (data.context) {
        console.error(chalk.dim("  Context:"), JSON.stringify(data.context));
      }
    }
    return;
  }

  if (err instanceof AgentCraftError) {
    console.error(chalk.red(`[${err.code}]`), err.message);
    if (err.context && Object.keys(err.context).length > 0) {
      console.error(chalk.dim("  Context:"), JSON.stringify(err.context));
    }
    return;
  }

  if (err instanceof Error) {
    console.error(chalk.red("Error:"), err.message);
  } else {
    console.error(chalk.red("Error:"), String(err));
  }
}
