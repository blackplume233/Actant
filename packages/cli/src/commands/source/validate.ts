import chalk from "chalk";
import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";
import type { SourceValidateResult, SourceValidationIssueDto } from "@actant/shared";

export function createSourceValidateCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("validate")
    .description("Validate all assets in a component source")
    .argument("[name]", "Registered source name to validate")
    .option("--path <dir>", "Validate a local directory directly (no registration needed)")
    .option("-f, --format <format>", "Output format: table, json", "table")
    .option("--strict", "Treat warnings as errors", false)
    .option("--compat <standard>", "Enable compatibility checks (e.g. agent-skills)")
    .action(async (name?: string, opts?: { path?: string; format: OutputFormat; strict: boolean; compat?: string }) => {
      try {
        if (!name && !opts?.path) {
          printer.error("Provide a source name or --path <dir>");
          process.exitCode = 1;
          return;
        }

        const result: SourceValidateResult = await client.call("source.validate", {
          name: name || undefined,
          path: opts?.path || undefined,
          strict: opts?.strict || false,
          compat: opts?.compat || undefined,
        });

        if (opts?.format === "json") {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          printTableReport(result, printer);
        }

        if (!result.valid) {
          process.exitCode = 1;
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}

function printTableReport(report: SourceValidateResult, printer: CliPrinter): void {
  printer.log("");
  printer.log(`Validating source: ${chalk.bold(report.sourceName)} (${report.rootDir})`);
  printer.log("");

  const grouped = groupByPath(report.issues);
  const reportedPaths = new Set<string>();

  for (const [path, issues] of grouped) {
    reportedPaths.add(path);
    for (const issue of issues) {
      const tag = severityTag(issue.severity);
      const comp = issue.component ? ` (${issue.component})` : "";
      printer.log(`  ${tag}  ${path}${comp} — ${issue.message}`);
    }
  }

  // Show passing files that had no issues
  if (report.summary.pass > 0) {
    const passMsg = chalk.green(`${report.summary.pass} component(s) passed`);
    const errMsg = report.summary.error > 0 ? chalk.red(`, ${report.summary.error} error(s)`) : "";
    const warnMsg = report.summary.warn > 0 ? chalk.yellow(`, ${report.summary.warn} warning(s)`) : "";
    printer.log("");
    printer.log(`Summary: ${passMsg}${warnMsg}${errMsg}`);
  } else if (report.issues.length === 0) {
    printer.log(chalk.dim("  No components found to validate."));
  }

  printer.log("");
  if (report.valid) {
    printer.log(chalk.green("Validation passed."));
  } else {
    printer.log(chalk.red("Validation failed."));
  }
}

function severityTag(severity: string): string {
  switch (severity) {
    case "error": return chalk.red("[ERROR]");
    case "warning": return chalk.yellow("[WARN] ");
    case "info": return chalk.blue("[INFO] ");
    default: return `[${severity}]`;
  }
}

function groupByPath(issues: SourceValidationIssueDto[]): Map<string, SourceValidationIssueDto[]> {
  const map = new Map<string, SourceValidationIssueDto[]>();
  for (const issue of issues) {
    let arr = map.get(issue.path);
    if (!arr) {
      arr = [];
      map.set(issue.path, arr);
    }
    arr.push(issue);
  }
  return map;
}
