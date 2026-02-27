import type {
  SessionCreateParams,
  SessionCreateResult,
  SessionPromptParams,
  SessionPromptResult,
  SessionCancelParams,
  SessionCancelResult,
  SessionCloseParams,
  SessionCloseResult,
  SessionListParams,
  SessionListResult,
  SessionLeaseInfo,
} from "@actant/shared";
import { createLogger } from "@actant/shared";
import type { SessionLease } from "@actant/core";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

const logger = createLogger("session-handlers");

export function registerSessionHandlers(registry: HandlerRegistry): void {
  registry.register("session.create", handleSessionCreate);
  registry.register("session.prompt", handleSessionPrompt);
  registry.register("session.cancel", handleSessionCancel);
  registry.register("session.close", handleSessionClose);
  registry.register("session.list", handleSessionList);
}

async function handleSessionCreate(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<SessionCreateResult> {
  const { agentName, clientId, idleTtlMs, conversationId } = params as unknown as SessionCreateParams;

  if (!agentName || typeof agentName !== 'string') {
    throw new Error('Required parameter "agentName" is missing or invalid');
  }
  if (!clientId || typeof clientId !== 'string') {
    throw new Error('Required parameter "clientId" is missing or invalid');
  }

  const meta = ctx.agentManager.getAgent(agentName);
  if (!meta) {
    throw new Error(`Agent "${agentName}" not found`);
  }
  if (meta.status !== "running") {
    throw new Error(`Agent "${agentName}" is not running (status: ${meta.status}). Start it with: actant agent start ${agentName}`);
  }
  if (!ctx.agentManager.hasAcpConnection(agentName)) {
    throw new Error(`Agent "${agentName}" has no ACP connection`);
  }

  const lease = ctx.sessionRegistry.create({ agentName, clientId, idleTtlMs, conversationId });

  logger.info({ sessionId: lease.sessionId, agentName, clientId }, "Session lease created");
  return toLeaseInfo(lease);
}

async function handleSessionPrompt(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<SessionPromptResult> {
  const { sessionId, text } = params as unknown as SessionPromptParams;

  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Required parameter "sessionId" is missing or invalid');
  }
  if (!text || typeof text !== 'string') {
    throw new Error('Required parameter "text" is missing or invalid');
  }

  const lease = ctx.sessionRegistry.get(sessionId);
  if (!lease) {
    throw new Error(`Session "${sessionId}" not found`);
  }
  if (lease.state === "expired") {
    throw new Error(`Session "${sessionId}" has expired`);
  }

  ctx.sessionRegistry.touch(sessionId);

  const result = await ctx.agentManager.promptAgent(
    lease.agentName,
    text,
    undefined,
    lease.conversationId,
  );

  ctx.sessionRegistry.touch(sessionId);

  return {
    stopReason: "end_turn",
    text: result.text,
    conversationId: lease.conversationId,
  };
}

async function handleSessionCancel(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<SessionCancelResult> {
  const { sessionId } = params as unknown as SessionCancelParams;

  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Required parameter "sessionId" is missing or invalid');
  }

  const lease = ctx.sessionRegistry.get(sessionId);
  if (!lease) {
    throw new Error(`Session "${sessionId}" not found`);
  }

  const conn = ctx.acpConnectionManager.getConnection(lease.agentName);
  if (!conn) {
    throw new Error(`Agent "${lease.agentName}" has no ACP connection`);
  }

  // Use the Agent's primary ACP session ID, not the lease session ID
  const acpSessionId = ctx.acpConnectionManager.getPrimarySessionId(lease.agentName);
  if (!acpSessionId) {
    throw new Error(`Agent "${lease.agentName}" has no primary ACP session`);
  }

  try {
    await conn.cancel(acpSessionId);
    logger.info({ sessionId, acpSessionId, agentName: lease.agentName }, "Session cancel sent to ACP");
  } catch (err) {
    logger.error({ sessionId, error: err }, "Failed to cancel ACP session");
    throw new Error(`Failed to cancel session: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  return { ok: true };
}

async function handleSessionClose(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<SessionCloseResult> {
  const { sessionId } = params as unknown as SessionCloseParams;

  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Required parameter "sessionId" is missing or invalid');
  }

  const closed = ctx.sessionRegistry.close(sessionId);
  if (!closed) {
    throw new Error(`Session "${sessionId}" not found`);
  }

  return { ok: true };
}

async function handleSessionList(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<SessionListResult> {
  const { agentName } = params as unknown as SessionListParams;
  return ctx.sessionRegistry.list(agentName).map(toLeaseInfo);
}

function toLeaseInfo(lease: SessionLease): SessionLeaseInfo {
  return {
    sessionId: lease.sessionId,
    agentName: lease.agentName,
    clientId: lease.clientId,
    state: lease.state,
    createdAt: lease.createdAt,
    lastActivityAt: lease.lastActivityAt,
    idleTtlMs: lease.idleTtlMs,
    conversationId: lease.conversationId,
  };
}
