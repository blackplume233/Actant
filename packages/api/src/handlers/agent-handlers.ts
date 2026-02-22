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
  AgentResolveParams,
  AgentResolveResult,
  AgentAttachParams,
  AgentAttachResult,
  AgentDetachParams,
  AgentDetachResult,
  AgentRunParams,
  AgentRunResult,
  AgentPromptParams,
  AgentPromptResult,
} from "@actant/shared";
import { AgentNotFoundError } from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerAgentHandlers(registry: HandlerRegistry): void {
  registry.register("agent.create", handleAgentCreate);
  registry.register("agent.start", handleAgentStart);
  registry.register("agent.stop", handleAgentStop);
  registry.register("agent.destroy", handleAgentDestroy);
  registry.register("agent.status", handleAgentStatus);
  registry.register("agent.list", handleAgentList);
  registry.register("agent.resolve", handleAgentResolve);
  registry.register("agent.attach", handleAgentAttach);
  registry.register("agent.detach", handleAgentDetach);
  registry.register("agent.run", handleAgentRun);
  registry.register("agent.prompt", handleAgentPrompt);
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

async function handleAgentResolve(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentResolveResult> {
  const { name, template, overrides } = params as unknown as AgentResolveParams;
  return ctx.agentManager.resolveAgent(name, template, overrides);
}

async function handleAgentAttach(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentAttachResult> {
  const { name, pid, metadata } = params as unknown as AgentAttachParams;
  return ctx.agentManager.attachAgent(name, pid, metadata);
}

async function handleAgentDetach(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentDetachResult> {
  const { name, cleanup } = params as unknown as AgentDetachParams;
  return ctx.agentManager.detachAgent(name, { cleanup });
}

async function handleAgentRun(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentRunResult> {
  const { name, prompt, options } = params as unknown as AgentRunParams;
  return ctx.agentManager.runPrompt(name, prompt, options);
}

async function handleAgentPrompt(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentPromptResult> {
  const { name, message, sessionId } = params as unknown as AgentPromptParams;
  const result = await ctx.agentManager.promptAgent(name, message, sessionId);
  return {
    response: result.text,
    sessionId: result.sessionId ?? "",
  };
}
