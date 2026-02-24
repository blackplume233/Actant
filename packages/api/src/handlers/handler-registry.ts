import type { AppContext } from "../services/app-context";

export type RpcHandler = (params: Record<string, unknown>, ctx: AppContext) => Promise<unknown>;

export class HandlerRegistry {
  private handlers = new Map<string, RpcHandler>();

  register(method: string, handler: RpcHandler): void {
    this.handlers.set(method, handler);
  }

  get(method: string): RpcHandler | undefined {
    return this.handlers.get(method);
  }

  has(method: string): boolean {
    return this.handlers.has(method);
  }

  methods(): string[] {
    return Array.from(this.handlers.keys());
  }
}
