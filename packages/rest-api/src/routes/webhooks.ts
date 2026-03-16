import type { Router } from "../router";
import { json, error } from "../router";

/**
 * Webhook endpoints for external integrations (n8n, Slack, Discord, WeChat, etc.)
 *
 * These provide simplified interfaces that map to internal agent operations,
 * designed for easy HTTP-based automation without needing to know agent internals.
 */
export function registerWebhookRoutes(router: Router): void {
  // -----------------------------------------------------------------------
  // POST /v1/webhooks/message — Universal message ingress
  //
  // Accepts a message and routes it to a named agent.
  // Designed for n8n HTTP Request nodes, Slack slash commands, etc.
  //
  // Body: { agent, message, metadata? }
  // Returns: { response, sessionId, agent }
  // -----------------------------------------------------------------------
  router.post("/v1/webhooks/message", async (ctx, _req, res) => {
    const { agent, message, metadata } = ctx.body;
    if (!agent || !message) {
      return error(res, "agent and message are required", 400);
    }

    const agentName = String(agent);
    const text = String(message);

    try {
      const result = await ctx.bridge.call("agent.prompt", {
        name: agentName,
        message: text,
      }, { timeoutMs: 305_000 }) as { response: string; sessionId: string };

      json(res, {
        agent: agentName,
        response: result.response,
        sessionId: result.sessionId,
        ...(metadata ? { metadata } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error(res, `Agent "${agentName}" error: ${msg}`, 502);
    }
  });

  // -----------------------------------------------------------------------
  // POST /v1/webhooks/run — Fire-and-wait one-shot prompt
  //
  // Like /message but uses agent.run (creates + starts agent if needed).
  // Body: { agent, prompt, template? }
  // -----------------------------------------------------------------------
  router.post("/v1/webhooks/run", async (ctx, _req, res) => {
    const { agent, prompt, template } = ctx.body;
    if (!agent || !prompt) {
      return error(res, "agent and prompt are required", 400);
    }

    const agentName = String(agent);
    const promptText = String(prompt);

    const RUN_TIMEOUT_MS = 120_000;
    try {
      const rpcPromise = ctx.bridge.call("agent.run", {
        name: agentName,
        prompt: promptText,
        ...(template ? { template: String(template) } : {}),
      }) as Promise<{ text: string; sessionId?: string }>;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("agent.run timed out after 120s")), RUN_TIMEOUT_MS),
      );

      const result = await Promise.race([rpcPromise, timeoutPromise]);

      json(res, {
        agent: agentName,
        response: result.text,
        sessionId: result.sessionId ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error(res, `Agent "${agentName}" error: ${msg}`, 502);
    }
  });

  // -----------------------------------------------------------------------
  // POST /v1/webhooks/event — Receive external events
  //
  // Allows external systems to inject events into the EventBus.
  // Can be used to trigger hook-based agent workflows.
  //
  // Body: { event (required), agentName (required), payload? (optional object) }
  // Response: 200 { ok: true } | 400 invalid input | 404 agent not found | 502 RPC failure
  // -----------------------------------------------------------------------
  router.post("/v1/webhooks/event", async (ctx, _req, res) => {
    const { event, agentName, payload } = ctx.body;

    // Require event: string, non-empty
    const eventStr = typeof event === "string" ? event.trim() : "";
    if (!eventStr) {
      return error(res, "event is required and must be a non-empty string", 400);
    }

    // Require agentName: string, non-empty
    const agentNameStr = typeof agentName === "string" ? agentName.trim() : "";
    if (!agentNameStr) {
      return error(res, "agentName is required and must be a non-empty string", 400);
    }

    // Optional payload: must be plain object if provided
    let payloadObj: Record<string, unknown> | undefined;
    if (payload !== undefined && payload !== null) {
      if (typeof payload !== "object" || Array.isArray(payload)) {
        return error(res, "payload must be an object when provided", 400);
      }
      payloadObj = payload as Record<string, unknown>;
    }

    try {
      const result = await ctx.bridge.call("events.emit", {
        event: eventStr,
        agentName: agentNameStr,
        ...(payloadObj !== undefined ? { payload: payloadObj } : {}),
      });
      json(res, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const rpcErr = err as { code?: number; data?: { errorCode?: string } };
      const actantCode = rpcErr.data?.errorCode;

      let status = 502;
      if (actantCode === "AGENT_NOT_FOUND" || actantCode === "SESSION_NOT_FOUND") status = 404;
      else if (actantCode === "INVALID_PARAMS" || actantCode === "SESSION_VALIDATION_ERROR") status = 400;
      else if (rpcErr.code === -32003 || rpcErr.code === -32001) status = 404;
      else if (rpcErr.code === -32002 || rpcErr.code === -32602) status = 400;

      error(res, msg, status);
    }
  });
}
