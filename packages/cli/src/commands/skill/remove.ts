import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createSkillRemoveCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("remove")
    .alias("rm")
    .description("Remove a loaded skill")
    .argument("<name>", "Skill name")
    .action(async (name: string) => {
      try {
        const result = await client.call("skill.remove", { name });
        if (result.success) {
          printer.success(`Skill "${name}" removed.`);
        } else {
          printer.warn(`Skill "${name}" not found.`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
