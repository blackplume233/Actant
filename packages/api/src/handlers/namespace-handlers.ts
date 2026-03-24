import {
  RPC_ERROR_CODES,
  type NamespaceValidateResult,
} from "@actant/shared/core";
import type { AppContext } from "../services/app-context";
import {
  readNamespaceConfigDocument,
  validateNamespaceDocument,
} from "../services/namespace-authoring";
import type { HandlerRegistry } from "./handler-registry";

export function registerNamespaceHandlers(registry: HandlerRegistry): void {
  registry.register("namespace.validate", handleNamespaceValidate);
}

async function handleNamespaceValidate(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<NamespaceValidateResult> {
  const active = ctx.hubContext.getActiveProject();
  if (!active) {
    throw Object.assign(
      new Error('No active project. Run "actant hub status" first to activate a namespace.'),
      { code: RPC_ERROR_CODES.GENERIC_BUSINESS },
    );
  }

  const document = await readNamespaceConfigDocument(active.projectRoot);
  return validateNamespaceDocument(document);
}
