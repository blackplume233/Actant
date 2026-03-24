import type {
  HubActivateParams,
  HubActivateResult,
  HubStatusResult,
} from "@actant/shared/core";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerHubHandlers(registry: HandlerRegistry): void {
  registry.register("hub.activate", handleHubActivate);
  registry.register("hub.status", handleHubStatus);
}

async function handleHubActivate(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<HubActivateResult> {
  const { projectDir } = params as HubActivateParams;
  return ctx.hubContext.activate(projectDir);
}

async function handleHubStatus(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<HubStatusResult> {
  return ctx.hubContext.status(ctx.hostProfile, ctx.runtimeState);
}
