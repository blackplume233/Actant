import type {
  CatalogAddParams,
  CatalogRemoveParams,
  CatalogSyncParams,
  CatalogValidateParams,
  CatalogValidateResult,
  CatalogEntry,
} from "@actant/shared";
import { CatalogValidator } from "@actant/agent-runtime";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerCatalogHandlers(registry: HandlerRegistry): void {
  registry.register("catalog.list", handleCatalogList);
  registry.register("catalog.add", handleCatalogAdd);
  registry.register("catalog.remove", handleCatalogRemove);
  registry.register("catalog.sync", handleCatalogSync);
  registry.register("catalog.validate", handleCatalogValidate);
}

async function handleCatalogList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<CatalogEntry[]> {
  return ctx.catalogManager.listCatalogs();
}

async function handleCatalogAdd(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<{ name: string; components: Record<string, number> }> {
  const { name, config } = params as unknown as CatalogAddParams;
  const result = await ctx.catalogManager.addCatalog(name, config);
  ctx.refreshContextMounts();

  ctx.eventBus.emit("catalog:updated", { callerType: "system", callerId: "CatalogManager" }, undefined, {
    "catalog.name": name,
    "catalog.type": config.type,
  });

  return {
    name,
    components: {
      skills: result.skills.length,
      prompts: result.prompts.length,
      mcp: result.mcpServers.length,
      workflows: result.workflows.length,
      presets: result.presets.length,
    },
  };
}

async function handleCatalogRemove(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<{ success: boolean }> {
  const { name } = params as unknown as CatalogRemoveParams;
  const success = await ctx.catalogManager.removeCatalog(name);
  if (success) {
    ctx.refreshContextMounts();
    ctx.eventBus.emit("catalog:updated", { callerType: "system", callerId: "CatalogManager" }, undefined, {
      "catalog.name": name,
    });
  }
  return { success };
}

async function handleCatalogSync(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<{ synced: string[]; report?: { addedCount: number; updatedCount: number; removedCount: number; hasBreakingChanges: boolean } }> {
  const { name } = params as unknown as CatalogSyncParams;
  if (name) {
    const { report } = await ctx.catalogManager.syncCatalogWithReport(name);
    ctx.refreshContextMounts();

    ctx.eventBus.emit("catalog:updated", { callerType: "system", callerId: "CatalogManager" }, undefined, {
      "catalog.name": name,
    });

    return {
      synced: [name],
      report: {
        addedCount: report.added.length,
        updatedCount: report.updated.length,
        removedCount: report.removed.length,
        hasBreakingChanges: report.hasBreakingChanges,
      },
    };
  }
  const { report } = await ctx.catalogManager.syncAllCatalogsWithReport();
  const synced = ctx.catalogManager.listCatalogs().map((catalog) => catalog.name);
  ctx.refreshContextMounts();

  for (const catalogName of synced) {
    ctx.eventBus.emit("catalog:updated", { callerType: "system", callerId: "CatalogManager" }, undefined, {
      "catalog.name": catalogName,
    });
  }

  return {
    synced,
    report: {
      addedCount: report.added.length,
      updatedCount: report.updated.length,
      removedCount: report.removed.length,
      hasBreakingChanges: report.hasBreakingChanges,
    },
  };
}

async function handleCatalogValidate(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<CatalogValidateResult> {
  const { name, path, strict, compat, community } = params as unknown as CatalogValidateParams;

  let rootDir: string;
  let isCommunity = community ?? false;
  if (path) {
    rootDir = path;
  } else if (name) {
    rootDir = ctx.catalogManager.getCatalogRootDir(name);
    const catalogs = ctx.catalogManager.listCatalogs();
    const entry = catalogs.find((catalog) => catalog.name === name);
    if (entry?.config.type === "community") {
      isCommunity = true;
    }
  } else {
    throw new Error("Either 'name' or 'path' parameter is required");
  }

  const validator = new CatalogValidator();
  const report = await validator.validate(rootDir, {
    strict,
    compat: compat as "agent-skills" | undefined,
    community: isCommunity,
  });
  return report;
}
