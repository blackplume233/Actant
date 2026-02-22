import { ConfigNotFoundError } from "@actant/shared";
import type {
  PresetListParams,
  PresetShowParams,
  PresetApplyParams,
  PresetDefinition,
  AgentTemplate,
} from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerPresetHandlers(registry: HandlerRegistry): void {
  registry.register("preset.list", handlePresetList);
  registry.register("preset.show", handlePresetShow);
  registry.register("preset.apply", handlePresetApply);
}

async function handlePresetList(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<PresetDefinition[]> {
  const { packageName } = params as unknown as PresetListParams;
  return ctx.sourceManager.listPresets(packageName);
}

async function handlePresetShow(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<PresetDefinition> {
  const { qualifiedName } = params as unknown as PresetShowParams;
  const preset = ctx.sourceManager.getPreset(qualifiedName);
  if (!preset) {
    throw new ConfigNotFoundError(`Preset "${qualifiedName}" not found`);
  }
  return preset;
}

async function handlePresetApply(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentTemplate> {
  const { qualifiedName, templateName } = params as unknown as PresetApplyParams;
  const template = ctx.templateRegistry.get(templateName);
  if (!template) {
    throw new ConfigNotFoundError(`Template "${templateName}" not found`);
  }
  return ctx.sourceManager.applyPreset(qualifiedName, template);
}
