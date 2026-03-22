import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createCatalogListCommand } from "./list";
import { createCatalogAddCommand } from "./add";
import { createCatalogRemoveCommand } from "./remove";
import { createCatalogSyncCommand } from "./sync";
import { createCatalogValidateCommand } from "./validate";

export function createCatalogCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("catalog")
    .description("Manage component catalogs (GitHub repos, local dirs)");

  cmd.addCommand(createCatalogListCommand(client, printer));
  cmd.addCommand(createCatalogAddCommand(client, printer));
  cmd.addCommand(createCatalogRemoveCommand(client, printer));
  cmd.addCommand(createCatalogSyncCommand(client, printer));
  cmd.addCommand(createCatalogValidateCommand(client, printer));

  return cmd;
}
