import chalk from "chalk";
import { ActantError } from "@actant/shared/core";
import { RpcCallError, ConnectionError } from "../client/rpc-client";
import { type CliPrinter, defaultPrinter } from "./printer";

function formatContextValue(value: unknown): string {
  if (typeof value === "string") return value;

  return JSON.stringify(
    value,
    (_key, nestedValue) => {
      if (nestedValue instanceof Error) {
        return {
          name: nestedValue.name,
          message: nestedValue.message,
          ...(nestedValue.cause !== undefined ? { cause: nestedValue.cause } : {}),
        };
      }
      return nestedValue;
    },
    2,
  );
}

export function presentError(err: unknown, printer: CliPrinter = defaultPrinter): void {
  if (err instanceof ConnectionError) {
    printer.errorStyled("Cannot connect to daemon.");
    printer.errorDim("Start with: actant daemon start");
    return;
  }

  if (err instanceof RpcCallError) {
    printer.error(`${chalk.red(`[RPC ${err.code}]`)} ${err.message}`);
    if (err.data && typeof err.data === "object") {
      const data = err.data as Record<string, unknown>;
      if (data.context) {
        printer.error(`${chalk.dim("  Context:")} ${formatContextValue(data.context)}`);
      }
      if (data.errorCode) {
        printer.errorDim(`  Code: ${String(data.errorCode)}`);
      }
    }
    return;
  }

  if (err instanceof ActantError) {
    printer.error(`${chalk.red(`[${err.code}]`)} ${err.message}`);
    if (err.context && Object.keys(err.context).length > 0) {
      printer.error(`${chalk.dim("  Context:")} ${formatContextValue(err.context)}`);
    }
    return;
  }

  if (err instanceof Error) {
    printer.error(`${chalk.red("Error:")} ${err.message}`);
  } else {
    printer.error(`${chalk.red("Error:")} ${String(err)}`);
  }
}
