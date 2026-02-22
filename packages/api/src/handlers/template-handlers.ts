import { copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
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
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

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
  const template = await ctx.templateLoader.loadFromFile(filePath);
  const destFile = join(ctx.templatesDir, `${template.name}.json`);
  await copyFile(resolve(filePath), destFile);
  ctx.templateRegistry.register(template);
  return template;
}

async function handleTemplateUnload(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<TemplateUnloadResult> {
  const { name } = params as unknown as TemplateUnloadParams;
  const removed = ctx.templateRegistry.unregister(name);
  return { success: removed };
}

async function handleTemplateValidate(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<TemplateValidateResult> {
  const { filePath } = params as unknown as TemplateValidateParams;
  try {
    const template = await ctx.templateLoader.loadFromFile(filePath);
    return { valid: true, template };
  } catch (err) {
    const validationErrors = (err as { validationErrors?: Array<{ path: string; message: string }> }).validationErrors;
    return {
      valid: false,
      errors: validationErrors ?? [{ path: "", message: err instanceof Error ? err.message : String(err) }],
    };
  }
}
