import { resolve } from "node:path";
import type {
  TemplateListResult,
  TemplateGetParams,
  TemplateGetResult,
  TemplateLoadParams,
  TemplateLoadResult,
  TemplateUnloadParams,
  TemplateUnloadResult,
  TemplateValidateParams,
  TemplateValidateResult,
} from "@actant/shared";
import { createLogger } from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

const logger = createLogger("template-handlers");

export function registerTemplateHandlers(registry: HandlerRegistry): void {
  registry.register("template.list", handleTemplateList);
  registry.register("template.get", handleTemplateGet);
  registry.register("template.load", handleTemplateLoad);
  registry.register("template.unload", handleTemplateUnload);
  registry.register("template.validate", handleTemplateValidate);
}

async function handleTemplateList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<TemplateListResult> {
  return ctx.templateRegistry.list();
}

async function handleTemplateGet(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<TemplateGetResult> {
  const { name } = params as unknown as TemplateGetParams;
  return ctx.templateRegistry.getOrThrow(name);
}

async function handleTemplateLoad(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<TemplateLoadResult> {
  const { filePath } = params as unknown as TemplateLoadParams;
  const template = await ctx.templateLoader.loadFromFile(resolve(filePath));
  ctx.templateRegistry.register(template);
  await ctx.templateRegistry.persist(template);

  ctx.eventBus?.emit("template:loaded", { callerType: "user", callerId: "api" }, {
    "template.name": template.name,
    "template.version": template.version,
    "template.backendType": template.backend?.type,
    "template.archetype": template.archetype,
  });
  logger.info({ name: template.name }, "Template loaded (event emitted)");

  return template;
}

async function handleTemplateUnload(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<TemplateUnloadResult> {
  const { name } = params as unknown as TemplateUnloadParams;
  const removed = ctx.templateRegistry.unregister(name);

  if (removed) {
    ctx.eventBus?.emit("template:unloaded", { callerType: "user", callerId: "api" }, {
      "template.name": name,
    });
    logger.info({ name }, "Template unloaded (event emitted)");
  }

  return { success: removed };
}

async function handleTemplateValidate(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<TemplateValidateResult> {
  const { filePath } = params as unknown as TemplateValidateParams;
  try {
    const template = await ctx.templateLoader.loadFromFile(filePath);
    const { validateTemplate } = await import("@actant/core");
    const deep = validateTemplate(template);

    ctx.eventBus?.emit("template:validated", { callerType: "user", callerId: "api" }, {
      "template.name": template.name, valid: true, errorCount: 0,
    });

    return {
      valid: true,
      template,
      warnings: deep.warnings.map((w) => ({ path: w.path, message: w.message })),
    };
  } catch (err) {
    const validationErrors = (err as { validationErrors?: Array<{ path: string; message: string }> }).validationErrors;

    ctx.eventBus?.emit("template:validated", { callerType: "user", callerId: "api" }, {
      valid: false, errorCount: validationErrors?.length ?? 1,
    });

    return {
      valid: false,
      errors: validationErrors ?? [{ path: "", message: err instanceof Error ? err.message : String(err) }],
    };
  }
}
