import { RPC_ERROR_CODES, createLogger } from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

const logger = createLogger("internal-handlers");
const MAX_HTML_BYTES = 512 * 1024; // 512 KB

export function registerInternalHandlers(registry: HandlerRegistry): void {
  registry.register("internal.validateToken", handleValidateToken);
  registry.register("internal.canvasUpdate", handleInternalCanvasUpdate);
  registry.register("internal.canvasClear", handleInternalCanvasClear);
}

async function handleValidateToken(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<{ agentName: string; sessionId: string; pid?: number }> {
  const { token } = params;
  if (typeof token !== "string" || !token) {
    throw Object.assign(new Error("token is required"), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }

  const session = ctx.sessionTokenStore.validate(token);
  if (!session) {
    throw Object.assign(new Error("Invalid or expired session token"), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }

  return {
    agentName: session.agentName,
    sessionId: session.sessionId,
    pid: session.pid,
  };
}

/**
 * Token-authenticated wrapper for canvas.update.
 * Validates token → resolves agentName → delegates to CanvasStore → records audit.
 */
async function handleInternalCanvasUpdate(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<{ ok: true }> {
  const session = requireToken(params, ctx);

  const html = params.html as string | undefined;
  const title = params.title as string | undefined;
  if (typeof html !== "string") {
    recordAuditFailure(ctx, session, "canvas.update", "html is required");
    throw Object.assign(new Error("html is required"), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }
  if (Buffer.byteLength(html, "utf-8") > MAX_HTML_BYTES) {
    recordAuditFailure(ctx, session, "canvas.update", `html exceeds ${MAX_HTML_BYTES} bytes`);
    throw Object.assign(new Error(`html exceeds maximum size of ${MAX_HTML_BYTES} bytes`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }

  const startMs = Date.now();
  ctx.canvasStore.update(session.agentName, html, title);
  const durationMs = Date.now() - startMs;

  recordAudit(ctx, session, "canvas.update", { html: html.slice(0, 200), title }, { ok: true }, durationMs);
  return { ok: true };
}

async function handleInternalCanvasClear(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<{ ok: true }> {
  const session = requireToken(params, ctx);

  const startMs = Date.now();
  ctx.canvasStore.remove(session.agentName);
  const durationMs = Date.now() - startMs;

  recordAudit(ctx, session, "canvas.clear", {}, { ok: true }, durationMs);
  return { ok: true };
}

function requireToken(
  params: Record<string, unknown>,
  ctx: AppContext,
): { agentName: string; sessionId: string; pid?: number; token: string } {
  const token = params.token as string | undefined;
  if (!token) {
    logger.warn("Internal tool call rejected: missing token");
    throw Object.assign(new Error("token is required"), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }

  const session = ctx.sessionTokenStore.validate(token);
  if (!session) {
    logger.warn({ tokenPrefix: token.slice(0, 8) }, "Internal tool call rejected: invalid token");
    throw Object.assign(new Error("Invalid or expired session token"), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }

  return { ...session, token };
}

function recordAudit(
  ctx: AppContext,
  session: { agentName: string; sessionId: string; pid?: number; token: string },
  tool: string,
  params: Record<string, unknown>,
  result: unknown,
  durationMs: number,
): void {
  ctx.activityRecorder?.record(session.agentName, session.sessionId, {
    type: "internal_tool_call",
    data: {
      tool,
      params,
      callerPid: session.pid,
      tokenPrefix: session.token.slice(0, 8),
      result,
      durationMs,
      source: "cli",
    },
  }).catch(() => {});
}

function recordAuditFailure(
  ctx: AppContext,
  session: { agentName: string; sessionId: string; token: string },
  tool: string,
  reason: string,
): void {
  ctx.activityRecorder?.record(session.agentName, session.sessionId, {
    type: "internal_tool_call",
    data: {
      tool,
      params: {},
      tokenPrefix: session.token.slice(0, 8),
      result: { error: reason },
      durationMs: 0,
      source: "cli",
    },
  }).catch(() => {});
}
