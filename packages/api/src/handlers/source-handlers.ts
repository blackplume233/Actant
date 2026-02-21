import type {
  SourceAddParams,
  SourceRemoveParams,
  SourceSyncParams,
  SourceEntry,
} from "@agentcraft/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerSourceHandlers(registry: HandlerRegistry): void {
  registry.register("source.list", handleSourceList);
  registry.register("source.add", handleSourceAdd);
  registry.register("source.remove", handleSourceRemove);
  registry.register("source.sync", handleSourceSync);
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
): Promise<{ synced: string[] }> {
  const { name } = params as unknown as SourceSyncParams;
  if (name) {
    await ctx.sourceManager.syncSource(name);
    return { synced: [name] };
  }
  await ctx.sourceManager.syncAll();
  return { synced: ctx.sourceManager.listSources().map((s) => s.name) };
}
