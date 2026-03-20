import {
  createLogger,
  type SourceTrait,
  type SourceRequirement,
  type SourceTypeDefinition,
  type VfsLifecycle,
  type VfsMountParams,
  type VfsSourceRegistration,
} from "@actant/shared";

const logger = createLogger("vfs-source-type");

function validateTraitExclusions(traits: ReadonlySet<SourceTrait>, context: string): void {
  if (traits.has("persistent") && traits.has("ephemeral")) {
    throw new Error(`${context} cannot declare both "persistent" and "ephemeral" traits`);
  }
}

export class SourceTypeRegistry {
  private definitions = new Map<string, SourceTypeDefinition<Record<string, unknown>>>();

  register<TConfig>(definition: SourceTypeDefinition<TConfig>): void {
    validateTraitExclusions(definition.defaultTraits, `Source type "${definition.type}"`);

    if (this.definitions.has(definition.type)) {
      logger.warn({ type: definition.type }, "Overwriting existing source type definition");
    }

    this.definitions.set(definition.type, definition as SourceTypeDefinition<Record<string, unknown>>);
    logger.debug({ type: definition.type }, "Source type definition registered");
  }

  unregister(type: string): boolean {
    return this.definitions.delete(type);
  }

  has(type: string): boolean {
    return this.definitions.has(type);
  }

  get(type: string): SourceTypeDefinition<Record<string, unknown>> | undefined {
    return this.definitions.get(type);
  }

  create<TConfig>(
    type: string,
    config: TConfig,
    mountPoint: string,
    lifecycle: VfsLifecycle,
  ): VfsSourceRegistration {
    const definition = this.definitions.get(type);
    if (!definition) {
      throw new Error(`No VFS source type registered for type "${type}"`);
    }

    const result = this.validate(type, config as Record<string, unknown>);
    if (!result.valid) {
      throw new Error(
        `Invalid VFS source config for type "${type}": ${result.errors?.join(", ")}`,
      );
    }

    const registration = definition.create(config as Record<string, unknown>, mountPoint, lifecycle);
    const traits = registration.traits ?? new Set(definition.defaultTraits);
    validateTraitExclusions(traits, `Source registration "${registration.name || mountPoint}"`);

    return {
      ...registration,
      label: registration.label || definition.label,
      traits,
    };
  }

  createMount<TConfig>(params: VfsMountParams<TConfig>): VfsSourceRegistration {
    const registration = this.create(params.type, params.config, params.mountPoint, params.lifecycle);
    registration.name = params.name;
    if (params.metadata) {
      registration.metadata = { ...registration.metadata, ...params.metadata };
    }
    return registration;
  }

  validate(type: string, config: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const definition = this.definitions.get(type);
    if (!definition) {
      return { valid: false, errors: [`No source type for "${type}"`] };
    }
    if (!definition.validate) {
      return { valid: true };
    }
    return definition.validate(config);
  }

  listTypes(): string[] {
    return Array.from(this.definitions.keys());
  }

  static satisfies(source: Pick<VfsSourceRegistration, "traits">, requirement: SourceRequirement): boolean {
    return requirement.required.every((trait) => source.traits.has(trait));
  }
}
