import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createSkillExportCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("export")
    .description("Export a skill to a JSON file")
    .argument("<name>", "Skill name")
    .option("-o, --out <file>", "Output file path", "./{name}.json")
    .action(async (name: string, opts: { out: string }) => {
      try {
        const outPath = opts.out.replace("{name}", name);
        await client.call("skill.export", { name, filePath: outPath });
        printer.success(`Skill "${name}" exported to ${outPath}`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
