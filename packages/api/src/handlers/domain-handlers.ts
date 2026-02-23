import { ConfigNotFoundError } from "@actant/shared";
import type {
  SkillGetParams,
  PromptGetParams,
  McpGetParams,
  WorkflowGetParams,
  PluginGetParams,
  PluginDefinition,
  ComponentAddParams,
  ComponentUpdateParams,
  ComponentRemoveParams,
  ComponentImportParams,
  ComponentExportParams,
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
} from "@actant/shared";
import type { BaseComponentManager, NamedComponent } from "@actant/core";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry, RpcHandler } from "./handler-registry";

// ---------------------------------------------------------------------------
// Generic CRUD handler factory
// ---------------------------------------------------------------------------

interface CrudHandlers {
  add: RpcHandler;
  update: RpcHandler;
  remove: RpcHandler;
  import: RpcHandler;
  export: RpcHandler;
}

function createCrudHandlers<T extends NamedComponent>(
  getManager: (ctx: AppContext) => BaseComponentManager<T>,
): CrudHandlers {
  return {
    add: async (params: Record<string, unknown>, ctx: AppContext) => {
      const { component } = params as unknown as ComponentAddParams;
      const mgr = getManager(ctx);
      await mgr.add(component as T, true);
      return { name: (component as { name: string }).name };
    },
    update: async (params: Record<string, unknown>, ctx: AppContext) => {
      const { name, patch } = params as unknown as ComponentUpdateParams;
      const result = await getManager(ctx).update(name, patch as Partial<T>, true);
      return { name: result.name };
    },
    remove: async (params: Record<string, unknown>, ctx: AppContext) => {
      const { name } = params as unknown as ComponentRemoveParams;
      const success = await getManager(ctx).remove(name, true);
      return { success };
    },
    import: async (params: Record<string, unknown>, ctx: AppContext) => {
      const { filePath } = params as unknown as ComponentImportParams;
      const result = await getManager(ctx).importFromFile(filePath);
      return { name: result.name };
    },
    export: async (params: Record<string, unknown>, ctx: AppContext) => {
      const { name, filePath } = params as unknown as ComponentExportParams;
      await getManager(ctx).exportToFile(name, filePath);
      return { success: true };
    },
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerDomainHandlers(registry: HandlerRegistry): void {
  registry.register("skill.list", handleSkillList);
  registry.register("skill.get", handleSkillGet);
  registry.register("prompt.list", handlePromptList);
  registry.register("prompt.get", handlePromptGet);
  registry.register("mcp.list", handleMcpList);
  registry.register("mcp.get", handleMcpGet);
  registry.register("workflow.list", handleWorkflowList);
  registry.register("workflow.get", handleWorkflowGet);
  registry.register("plugin.list", handlePluginList);
  registry.register("plugin.get", handlePluginGet);

  const skillCrud = createCrudHandlers<SkillDefinition>((ctx) => ctx.skillManager);
  const promptCrud = createCrudHandlers<PromptDefinition>((ctx) => ctx.promptManager);
  const mcpCrud = createCrudHandlers<McpServerDefinition>((ctx) => ctx.mcpConfigManager);
  const workflowCrud = createCrudHandlers<WorkflowDefinition>((ctx) => ctx.workflowManager);
  const pluginCrud = createCrudHandlers<PluginDefinition>((ctx) => ctx.pluginManager);

  const crudSets = [
    { prefix: "skill", crud: skillCrud },
    { prefix: "prompt", crud: promptCrud },
    { prefix: "mcp", crud: mcpCrud },
    { prefix: "workflow", crud: workflowCrud },
    { prefix: "plugin", crud: pluginCrud },
  ];

  for (const { prefix, crud } of crudSets) {
    registry.register(`${prefix}.add`, crud.add);
    registry.register(`${prefix}.update`, crud.update);
    registry.register(`${prefix}.remove`, crud.remove);
    registry.register(`${prefix}.import`, crud.import);
    registry.register(`${prefix}.export`, crud.export);
  }
}

// ---------------------------------------------------------------------------
// Existing read-only handlers (preserved)
// ---------------------------------------------------------------------------

async function handleSkillList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<SkillDefinition[]> {
  return ctx.skillManager.list();
}

async function handleSkillGet(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<SkillDefinition> {
  const { name } = params as unknown as SkillGetParams;
  const skill = ctx.skillManager.get(name);
  if (!skill) {
    throw new ConfigNotFoundError(`Skill "${name}" not found`);
  }
  return skill;
}

async function handlePromptList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<PromptDefinition[]> {
  return ctx.promptManager.list();
}

async function handlePromptGet(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<PromptDefinition> {
  const { name } = params as unknown as PromptGetParams;
  const prompt = ctx.promptManager.get(name);
  if (!prompt) {
    throw new ConfigNotFoundError(`Prompt "${name}" not found`);
  }
  return prompt;
}

async function handleMcpList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<McpServerDefinition[]> {
  return ctx.mcpConfigManager.list();
}

async function handleMcpGet(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<McpServerDefinition> {
  const { name } = params as unknown as McpGetParams;
  const mcp = ctx.mcpConfigManager.get(name);
  if (!mcp) {
    throw new ConfigNotFoundError(`MCP server "${name}" not found`);
  }
  return mcp;
}

async function handleWorkflowList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<WorkflowDefinition[]> {
  return ctx.workflowManager.list();
}

async function handleWorkflowGet(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<WorkflowDefinition> {
  const { name } = params as unknown as WorkflowGetParams;
  const workflow = ctx.workflowManager.get(name);
  if (!workflow) {
    throw new ConfigNotFoundError(`Workflow "${name}" not found`);
  }
  return workflow;
}

async function handlePluginList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<PluginDefinition[]> {
  return ctx.pluginManager.list();
}

async function handlePluginGet(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<PluginDefinition> {
  const { name } = params as unknown as PluginGetParams;
  const plugin = ctx.pluginManager.get(name);
  if (!plugin) {
    throw new ConfigNotFoundError(`Plugin "${name}" not found`);
  }
  return plugin;
}
