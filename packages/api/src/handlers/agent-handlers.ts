import type {
  AgentCreateParams,
  AgentCreateResult,
  AgentStartParams,
  AgentStartResult,
  AgentStopParams,
  AgentStopResult,
  AgentDestroyParams,
  AgentDestroyResult,
  AgentStatusParams,
  AgentStatusResult,
  AgentListResult,
} from "@agentcraft/shared";
import { AgentNotFoundError } from "@agentcraft/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerAgentHandlers(registry: HandlerRegistry): void {
  registry.register("agent.create", handleAgentCreate);
  registry.register("agent.start", handleAgentStart);
  registry.register("agent.stop", handleAgentStop);
  registry.register("agent.destroy", handleAgentDestroy);
  registry.register("agent.status", handleAgentStatus);
  registry.register("agent.list", handleAgentList);
}

async function handleAgentCreate(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentCreateResult> {
  const { name, template, overrides } = params as unknown as AgentCreateParams;
  return ctx.agentManager.createAgent(name, template, overrides);
}

async function handleAgentStart(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentStartResult> {
  const { name } = params as unknown as AgentStartParams;
  await ctx.agentManager.startAgent(name);
  const meta = ctx.agentManager.getAgent(name);
  if (!meta) throw new AgentNotFoundError(name);
  return meta;
}

async function handleAgentStop(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentStopResult> {
  const { name } = params as unknown as AgentStopParams;
  await ctx.agentManager.stopAgent(name);
  const meta = ctx.agentManager.getAgent(name);
  if (!meta) throw new AgentNotFoundError(name);
  return meta;
}

async function handleAgentDestroy(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentDestroyResult> {
  const { name } = params as unknown as AgentDestroyParams;
  await ctx.agentManager.destroyAgent(name);
  return { success: true };
}

async function handleAgentStatus(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentStatusResult> {
  const { name } = params as unknown as AgentStatusParams;
  const meta = ctx.agentManager.getAgent(name);
  if (!meta) throw new AgentNotFoundError(name);
  return meta;
}

async function handleAgentList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentListResult> {
  return ctx.agentManager.listAgents();
}
