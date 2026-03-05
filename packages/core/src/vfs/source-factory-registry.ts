import {
  createLogger,
  type VfsSourceSpec,
  type VfsSourceFactory,
  type VfsSourceRegistration,
  type VfsMountParams,
} from "@actant/shared";

const logger = createLogger("vfs-source-factory");

/**
 * Registry for VfsSourceFactory implementations.
 *
 * Factories convert declarative VfsSourceSpec (from RPC/CLI/Template) into
 * a full VfsSourceRegistration with handlers. This decouples the caller
 * from needing to know how to create handlers for each source type.
 */
export class SourceFactoryRegistry {
  private factories = new Map<string, VfsSourceFactory>();

  register<S extends VfsSourceSpec>(factory: VfsSourceFactory<S>): void {
    if (this.factories.has(factory.type)) {
      logger.warn({ type: factory.type }, "Overwriting existing source factory");
    }
    this.factories.set(factory.type, factory as VfsSourceFactory);
    logger.debug({ type: factory.type }, "Source factory registered");
  }

  unregister(type: string): boolean {
    return this.factories.delete(type);
  }

  has(type: string): boolean {
    return this.factories.has(type);
  }

  /**
   * Create a VfsSourceRegistration from declarative mount parameters.
   */
  create(params: VfsMountParams): VfsSourceRegistration {
    const factory = this.factories.get(params.spec.type);
    if (!factory) {
      throw new Error(`No VFS source factory registered for type "${params.spec.type}"`);
    }

    if (factory.validate) {
      const result = factory.validate(params.spec);
      if (!result.valid) {
        throw new Error(
          `Invalid VFS source spec for type "${params.spec.type}": ${result.errors?.join(", ")}`,
        );
      }
    }

    const registration = factory.create(params.spec, params.mountPoint, params.lifecycle);

    registration.name = params.name;
    if (params.metadata) {
      registration.metadata = { ...registration.metadata, ...params.metadata };
    }

    return registration;
  }

  /**
   * Validate a source spec without creating it.
   */
  validate(spec: VfsSourceSpec): { valid: boolean; errors?: string[] } {
    const factory = this.factories.get(spec.type);
    if (!factory) {
      return { valid: false, errors: [`No factory for type "${spec.type}"`] };
    }
    if (!factory.validate) {
      return { valid: true };
    }
    return factory.validate(spec);
  }

  listTypes(): string[] {
    return Array.from(this.factories.keys());
  }
}
