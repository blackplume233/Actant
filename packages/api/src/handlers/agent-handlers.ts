import { join } from "node:path";
import { readFile } from "node:fs/promises";
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
  AgentAdoptParams,
  AgentAdoptResult,
  AgentResolveParams,
  AgentResolveResult,
  AgentOpenParams,
  AgentOpenResult,
  AgentAttachParams,
  AgentAttachResult,
  AgentDetachParams,
  AgentDetachResult,
  AgentRunParams,
  AgentRunResult,
  AgentPromptParams,
  AgentPromptResult,
  AgentUpdatePermissionsParams,
  AgentUpdatePermissionsResult,
} from "@actant/shared";
import { AgentNotFoundError } from "@actant/shared";
import { resolvePermissionsWithMcp, PermissionAuditLogger } from "@actant/core";
import { updateInstanceMeta } from "@actant/core";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerAgentHandlers(registry: HandlerRegistry): void {
  registry.register("agent.create", handleAgentCreate);
  registry.register("agent.start", handleAgentStart);
  registry.register("agent.stop", handleAgentStop);
  registry.register("agent.destroy", handleAgentDestroy);
  registry.register("agent.status", handleAgentStatus);
  registry.register("agent.list", handleAgentList);
  registry.register("agent.adopt", handleAgentAdopt);
  registry.register("agent.resolve", handleAgentResolve);
  registry.register("agent.open", handleAgentOpen);
  registry.register("agent.attach", handleAgentAttach);
  registry.register("agent.detach", handleAgentDetach);
  registry.register("agent.run", handleAgentRun);
  registry.register("agent.prompt", handleAgentPrompt);
  registry.register("agent.updatePermissions", handleAgentUpdatePermissions);
  registry.register("agent.processLogs", handleAgentProcessLogs);
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
  const { name, autoInstall } = params as unknown as AgentStartParams;
  await ctx.agentManager.startAgent(name, { autoInstall });
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

async function handleAgentAdopt(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentAdoptResult> {
  const { path, rename } = params as unknown as AgentAdoptParams;
  const entry = await ctx.instanceRegistry.adopt(path, rename);
  return {
    name: entry.name,
    template: entry.template,
    workspacePath: entry.workspacePath,
    location: entry.location,
    createdAt: entry.createdAt,
    status: entry.status,
  };
}

async function handleAgentResolve(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentResolveResult> {
  const { name, template, overrides, autoInstall } = params as unknown as AgentResolveParams;
  return ctx.agentManager.resolveAgent(name, template, overrides, { autoInstall });
}

async function handleAgentOpen(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentOpenResult> {
  const { name, template, autoInstall } = params as unknown as AgentOpenParams;
  return ctx.agentManager.openAgent(name, template, { autoInstall });
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

async function handleAgentUpdatePermissions(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentUpdatePermissionsResult> {
  const { name, permissions } = params as unknown as AgentUpdatePermissionsParams;
  const meta = ctx.agentManager.getAgent(name);
  if (!meta) throw new AgentNotFoundError(name);

  const workspaceDir = join(ctx.instancesDir, name);

  // Resolve MCP server names from the existing config
  const mcpServers = ctx.mcpConfigManager.list().map((s) => s.name);
  const resolved = resolvePermissionsWithMcp(permissions, mcpServers);

  // Update .actant.json
  await updateInstanceMeta(workspaceDir, { effectivePermissions: resolved });

  // Update ACP Client enforcer if connected
  ctx.acpConnectionManager.updatePermissionPolicy(name, resolved);

  const auditLogger = new PermissionAuditLogger(name);
  auditLogger.logUpdated("rpc:agent.updatePermissions");

  return { effectivePermissions: resolved };
}

interface AgentProcessLogsParams {
  name: string;
  stream?: "stdout" | "stderr";
  lines?: number;
}

interface AgentProcessLogsResult {
  lines: string[];
  stream: string;
  logDir: string;
}

async function handleAgentProcessLogs(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentProcessLogsResult> {
  const { name, stream = "stdout", lines = 50 } = params as unknown as AgentProcessLogsParams;
  const meta = ctx.agentManager.getAgent(name);
  if (!meta) throw new AgentNotFoundError(name);

  const logDir = join(ctx.instancesDir, name, "logs");
  const logFile = join(logDir, `${stream}.log`);

  let content: string;
  try {
    content = await readFile(logFile, "utf-8");
  } catch {
    return { lines: [], stream, logDir };
  }

  const allLines = content.split("\n").filter(Boolean);
  return {
    lines: allLines.slice(-lines),
    stream,
    logDir,
  };
}
