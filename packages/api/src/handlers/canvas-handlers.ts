import type {
  CanvasUpdateParams,
  CanvasUpdateResult,
  CanvasGetParams,
  CanvasGetResult,
  CanvasListResult,
  CanvasClearParams,
  CanvasClearResult,
} from "@actant/shared";
import { RPC_ERROR_CODES } from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

const MAX_CANVAS_HTML_BYTES = 512 * 1024;

export function registerCanvasHandlers(registry: HandlerRegistry): void {
  registry.register("canvas.update", handleCanvasUpdate);
  registry.register("canvas.get", handleCanvasGet);
  registry.register("canvas.list", handleCanvasList);
  registry.register("canvas.clear", handleCanvasClear);
}

async function handleCanvasUpdate(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<CanvasUpdateResult> {
  const { agentName, html, title } = params as unknown as CanvasUpdateParams;
  if (!agentName || typeof html !== "string") {
    throw Object.assign(new Error("agentName and html are required"), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }

  if (Buffer.byteLength(html, "utf-8") > MAX_CANVAS_HTML_BYTES) {
    throw Object.assign(new Error(`html exceeds maximum size of ${MAX_CANVAS_HTML_BYTES} bytes`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }

  const meta = ctx.agentManager.getAgent(agentName);
  if (!meta) {
    throw Object.assign(new Error(`Agent "${agentName}" not found`), {
      code: RPC_ERROR_CODES.AGENT_NOT_FOUND,
    });
  }
  if (meta.archetype !== "employee") {
    throw Object.assign(
      new Error(`Canvas is only available for employee agents (got "${meta.archetype}")`),
      { code: RPC_ERROR_CODES.INVALID_PARAMS },
    );
  }

  ctx.canvasStore.update(agentName, html, title as string | undefined);
  return { ok: true };
}

async function handleCanvasGet(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<CanvasGetResult> {
  const { agentName } = params as unknown as CanvasGetParams;
  const entry = ctx.canvasStore.get(agentName);
  if (!entry) {
    throw Object.assign(new Error(`No canvas for agent "${agentName}"`), {
      code: RPC_ERROR_CODES.AGENT_NOT_FOUND,
    });
  }
  return entry;
}

async function handleCanvasList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<CanvasListResult> {
  return { entries: ctx.canvasStore.list() };
}

async function handleCanvasClear(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<CanvasClearResult> {
  const { agentName } = params as unknown as CanvasClearParams;
  if (!agentName) {
    throw Object.assign(new Error("agentName is required"), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }
  ctx.canvasStore.remove(agentName);
  return { ok: true };
}
