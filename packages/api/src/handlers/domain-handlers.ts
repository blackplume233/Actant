import { ConfigNotFoundError } from "@agentcraft/shared";
import type {
  SkillGetParams,
  PromptGetParams,
  McpGetParams,
  WorkflowGetParams,
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
} from "@agentcraft/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerDomainHandlers(registry: HandlerRegistry): void {
  registry.register("skill.list", handleSkillList);
  registry.register("skill.get", handleSkillGet);
  registry.register("prompt.list", handlePromptList);
  registry.register("prompt.get", handlePromptGet);
  registry.register("mcp.list", handleMcpList);
  registry.register("mcp.get", handleMcpGet);
  registry.register("workflow.list", handleWorkflowList);
  registry.register("workflow.get", handleWorkflowGet);
}

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
