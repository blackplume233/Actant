import {
  createLogger,
  type VfsFeature,
  type FilesystemRequirement,
  type FilesystemTypeDefinition,
  type VfsLifecycle,
  type VfsMountAddParams,
  type VfsMountRegistration,
} from "@actant/shared";

const logger = createLogger("vfs-source-type");

function validateTraitExclusions(features: ReadonlySet<VfsFeature>, context: string): void {
  if (features.has("persistent") && features.has("ephemeral")) {
    throw new Error(`${context} cannot declare both "persistent" and "ephemeral" features`);
  }
}

export class FilesystemTypeRegistry {
  private definitions = new Map<string, FilesystemTypeDefinition<Record<string, unknown>>>();

  register<TConfig>(definition: FilesystemTypeDefinition<TConfig>): void {
    validateTraitExclusions(definition.defaultFeatures, `Source type "${definition.type}"`);

    if (this.definitions.has(definition.type)) {
      logger.warn({ type: definition.type }, "Overwriting existing source type definition");
    }

    this.definitions.set(definition.type, definition as FilesystemTypeDefinition<Record<string, unknown>>);
    logger.debug({ type: definition.type }, "Source type definition registered");
  }

  unregister(type: string): boolean {
    return this.definitions.delete(type);
  }

  has(type: string): boolean {
    return this.definitions.has(type);
  }

  get(type: string): FilesystemTypeDefinition<Record<string, unknown>> | undefined {
    return this.definitions.get(type);
  }

  create<TConfig>(
    type: string,
    config: TConfig,
    mountPoint: string,
    lifecycle: VfsLifecycle,
  ): VfsMountRegistration {
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
    const features = registration.features ?? new Set(definition.defaultFeatures);
    validateTraitExclusions(features, `Source registration "${registration.name || mountPoint}"`);

    return {
      ...registration,
      label: registration.label || definition.label,
      features,
    };
  }

  createMount<TConfig>(params: VfsMountAddParams<TConfig>): VfsMountRegistration {
    const registration = this.create(params.type, params.config, params.mountPoint, params.lifecycle);
    registration.name = params.name;
    registration.metadata = {
      ...registration.metadata,
      filesystemType: typeof registration.metadata.filesystemType === "string"
        ? registration.metadata.filesystemType
        : params.type,
      mountType: params.mountType ?? registration.metadata.mountType ?? "direct",
      ...(params.metadata ?? {}),
    };
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

  static satisfies(source: Pick<VfsMountRegistration, "features">, requirement: FilesystemRequirement): boolean {
    return requirement.required.every((trait) => source.features.has(trait));
  }
}
