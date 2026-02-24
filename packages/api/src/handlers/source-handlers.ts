import type {
  SourceAddParams,
  SourceRemoveParams,
  SourceSyncParams,
  SourceValidateParams,
  SourceValidateResult,
  SourceEntry,
} from "@actant/shared";
import { SourceValidator } from "@actant/core";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerSourceHandlers(registry: HandlerRegistry): void {
  registry.register("source.list", handleSourceList);
  registry.register("source.add", handleSourceAdd);
  registry.register("source.remove", handleSourceRemove);
  registry.register("source.sync", handleSourceSync);
  registry.register("source.validate", handleSourceValidate);
}

async function handleSourceList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<SourceEntry[]> {
  return ctx.sourceManager.listSources();
}

async function handleSourceAdd(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<{ name: string; components: Record<string, number> }> {
  const { name, config } = params as unknown as SourceAddParams;
  const result = await ctx.sourceManager.addSource(name, config);
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

async function handleSourceRemove(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<{ success: boolean }> {
  const { name } = params as unknown as SourceRemoveParams;
  const success = await ctx.sourceManager.removeSource(name);
  return { success };
}

async function handleSourceSync(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<{ synced: string[]; report?: { addedCount: number; updatedCount: number; removedCount: number; hasBreakingChanges: boolean } }> {
  const { name } = params as unknown as SourceSyncParams;
  if (name) {
    const { report } = await ctx.sourceManager.syncSourceWithReport(name);
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
  const { report } = await ctx.sourceManager.syncAllWithReport();
  return {
    synced: ctx.sourceManager.listSources().map((s) => s.name),
    report: {
      addedCount: report.added.length,
      updatedCount: report.updated.length,
      removedCount: report.removed.length,
      hasBreakingChanges: report.hasBreakingChanges,
    },
  };
}

async function handleSourceValidate(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<SourceValidateResult> {
  const { name, path, strict } = params as unknown as SourceValidateParams;

  let rootDir: string;
  if (path) {
    rootDir = path;
  } else if (name) {
    rootDir = ctx.sourceManager.getSourceRootDir(name);
  } else {
    throw new Error("Either 'name' or 'path' parameter is required");
  }

  const validator = new SourceValidator();
  return validator.validate(rootDir, { strict });
}
