import type { InputSource } from "./inputs/input-source";

export type InputSourceFactory<TConfig = unknown> = (config: TConfig) => InputSource;

export class InputSourceRegistry {
  private readonly factories = new Map<string, InputSourceFactory>();

  register<TConfig = unknown>(type: string, factory: InputSourceFactory<TConfig>): void {
    this.factories.set(type, factory as InputSourceFactory);
  }

  unregister(type: string): boolean {
    return this.factories.delete(type);
  }

  has(type: string): boolean {
    return this.factories.has(type);
  }

  list(): string[] {
    return Array.from(this.factories.keys()).sort();
  }

  create<TConfig = unknown>(type: string, config: TConfig): InputSource {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Unknown input source type: ${type}`);
    }
    return factory(config);
  }
}
