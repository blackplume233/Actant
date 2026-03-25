import { Command } from "commander";
import type { NamespaceValidateResult } from "@actant/shared";
import type { RpcClient } from "../../client/rpc-client";
import { defaultPrinter, type CliPrinter, presentError } from "../../output/index";

export function createNamespaceCommand(
  client: RpcClient,
  printer: CliPrinter = defaultPrinter,
): Command {
  const namespace = new Command("namespace").description("Namespace configuration operations");

  namespace
    .command("validate")
    .description("Validate the active project's actant.namespace.json")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const result = await client.call("namespace.validate", {}) as NamespaceValidateResult;
        if (opts.json) {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          printer.log(`Project Root: ${result.projectRoot}`);
          printer.log(`Config Path:  ${result.configPath ?? "(missing)"}`);
          printer.log(`Schema:       ${result.schemaValid ? "valid" : "invalid"}`);
          renderIssues("Mounts", result.mountDeclarationIssues, printer);
          renderIssues("Derived", result.derivedViewPreconditions, printer);
          renderIssues("Warnings", result.warnings, printer);
        }

        process.exitCode = result.valid ? 0 : 1;
      } catch (error) {
        presentError(error, printer);
        process.exitCode = 1;
      }
    });

  return namespace;
}

function renderIssues(
  label: string,
  issues: Array<{ path?: string; message: string }>,
  printer: CliPrinter,
): void {
  if (issues.length === 0) {
    printer.log(`${label}:       ok`);
    return;
  }

  printer.log(`${label}:`);
  for (const issue of issues) {
    printer.log(issue.path ? `  - ${issue.path}: ${issue.message}` : `  - ${issue.message}`);
  }
}
