import type { ModelProviderDescriptor } from "@actant/shared";
import { createLogger } from "@actant/shared";

const logger = createLogger("model-provider-registry");

/**
 * Registry for model provider descriptors.
 *
 * Sources (registered at startup in this order):
 *   1. Built-in providers (anthropic, openai, deepseek, ...)
 *   2. Default provider from config.json `provider` field
 *   3. User-registered providers from config.json `providers` field
 *
 * Consumers:
 *   - Zod schema validation (warning for unknown types)
 *   - CLI setup wizard (dynamic provider list)
 *   - AgentInitializer (resolve default when template omits provider)
 *   - AgentManager (resolve provider → env vars for ACP)
 */
export class ModelProviderRegistry {
  private readonly descriptors = new Map<string, ModelProviderDescriptor>();
  private defaultType: string | undefined;

  register(descriptor: ModelProviderDescriptor): void {
    this.descriptors.set(descriptor.type, descriptor);
    logger.debug({ type: descriptor.type }, "Provider registered");
  }

  get(type: string): ModelProviderDescriptor | undefined {
    return this.descriptors.get(type);
  }

  getOrThrow(type: string): ModelProviderDescriptor {
    const desc = this.descriptors.get(type);
    if (!desc) {
      throw new Error(
        `Provider "${type}" is not registered. ` +
        `Available providers: [${[...this.descriptors.keys()].join(", ")}].`,
      );
    }
    return desc;
  }

  has(type: string): boolean {
    return this.descriptors.has(type);
  }

  list(): ModelProviderDescriptor[] {
    return [...this.descriptors.values()];
  }

  setDefault(type: string): void {
    if (!this.descriptors.has(type)) {
      throw new Error(
        `Cannot set default: provider "${type}" is not registered.`,
      );
    }
    this.defaultType = type;
    logger.info({ type }, "Default provider set");
  }

  getDefault(): ModelProviderDescriptor | undefined {
    if (!this.defaultType) return undefined;
    return this.descriptors.get(this.defaultType);
  }

  getDefaultType(): string | undefined {
    return this.defaultType;
  }

  /** @internal Test-only: clear all registrations. */
  _reset(): void {
    this.descriptors.clear();
    this.defaultType = undefined;
  }
}

/** Singleton instance used throughout the application. */
export const modelProviderRegistry = new ModelProviderRegistry();
