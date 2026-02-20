import { randomUUID } from "node:crypto";
import type {
  ProxyConnectParams,
  ProxyConnectResult,
  ProxyDisconnectParams,
  ProxyDisconnectResult,
  ProxyForwardParams,
  ProxyForwardResult,
  ProxySession,
} from "@agentcraft/shared";
import { createLogger } from "@agentcraft/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

const logger = createLogger("proxy-handlers");

const proxySessions = new Map<string, ProxySession>();

export function registerProxyHandlers(registry: HandlerRegistry): void {
  registry.register("proxy.connect", handleProxyConnect);
  registry.register("proxy.disconnect", handleProxyDisconnect);
  registry.register("proxy.forward", handleProxyForward);
}

async function handleProxyConnect(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<ProxyConnectResult> {
  const { agentName, envPassthrough } = params as unknown as ProxyConnectParams;

  const meta = ctx.agentManager.getAgent(agentName);
  if (!meta) {
    throw new Error(`Agent "${agentName}" not found`);
  }

  if (meta.status !== "running") {
    throw new Error(`Agent "${agentName}" is not running (status: ${meta.status})`);
  }

  if (!ctx.agentManager.hasAcpConnection(agentName)) {
    throw new Error(`Agent "${agentName}" has no ACP connection`);
  }

  const sessionId = randomUUID();
  const session: ProxySession = {
    sessionId,
    agentName,
    envPassthrough: envPassthrough ?? false,
    connectedAt: new Date().toISOString(),
  };
  proxySessions.set(sessionId, session);

  logger.info({ sessionId, agentName, envPassthrough }, "Proxy session connected");
  return session;
}

async function handleProxyDisconnect(
  params: Record<string, unknown>,
  _ctx: AppContext,
): Promise<ProxyDisconnectResult> {
  const { sessionId } = params as unknown as ProxyDisconnectParams;

  const session = proxySessions.get(sessionId);
  if (!session) {
    throw new Error(`Proxy session "${sessionId}" not found`);
  }

  proxySessions.delete(sessionId);
  logger.info({ sessionId, agentName: session.agentName }, "Proxy session disconnected");
  return { ok: true };
}

async function handleProxyForward(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<ProxyForwardResult> {
  const { sessionId, acpMessage } = params as unknown as ProxyForwardParams;

  const session = proxySessions.get(sessionId);
  if (!session) {
    throw new Error(`Proxy session "${sessionId}" not found`);
  }

  const method = acpMessage["method"] as string | undefined;
  if (!method) {
    throw new Error("ACP message missing 'method' field");
  }

  const acpParams = (acpMessage["params"] ?? {}) as Record<string, unknown>;

  switch (method) {
    case "session/prompt": {
      const prompt = acpParams["prompt"] as Array<{ type: string; text?: string }> | undefined;
      const text = prompt?.find((p) => p.type === "text")?.text ?? "";
      const result = await ctx.agentManager.promptAgent(session.agentName, text);
      return { result: { stopReason: "end_turn", text: result.text } };
    }
    case "session/cancel": {
      return { result: { ok: true } };
    }
    default:
      throw new Error(`Unsupported ACP method: ${method}`);
  }
}
