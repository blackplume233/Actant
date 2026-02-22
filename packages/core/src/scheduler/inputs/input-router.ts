import { createLogger } from "@actant/shared";
import type { TaskQueue } from "../task-queue";
import type { InputSource } from "./input-source";

const logger = createLogger("input-router");

export class InputRouter {
  private sources = new Map<string, InputSource>();
  private agentName?: string;

  constructor(private readonly queue: TaskQueue) {}

  /** Register an input source. */
  register(source: InputSource): void {
    if (this.sources.has(source.id)) {
      logger.warn({ id: source.id }, "Input source already registered, replacing");
      this.sources.get(source.id)?.stop();
    }
    this.sources.set(source.id, source);
    // If already started, start the new source too
    if (this.agentName) {
      source.start(this.agentName, (task) => this.queue.enqueue(task));
    }
  }

  /** Unregister an input source. */
  unregister(sourceId: string): boolean {
    const source = this.sources.get(sourceId);
    if (!source) return false;
    source.stop();
    this.sources.delete(sourceId);
    return true;
  }

  /** Start all registered input sources. */
  startAll(agentName: string): void {
    this.agentName = agentName;
    for (const source of this.sources.values()) {
      if (!source.active) {
        source.start(agentName, (task) => this.queue.enqueue(task));
      }
    }
    logger.info({ agentName, sourceCount: this.sources.size }, "InputRouter started all sources");
  }

  /** Stop all registered input sources. */
  stopAll(): void {
    for (const source of this.sources.values()) {
      source.stop();
    }
    this.agentName = undefined;
    logger.info("InputRouter stopped all sources");
  }

  /** Get all registered source IDs. */
  listSources(): { id: string; type: string; active: boolean }[] {
    return Array.from(this.sources.values()).map((s) => ({
      id: s.id,
      type: s.type,
      active: s.active,
    }));
  }

  /** Get a specific source by ID. */
  getSource(id: string): InputSource | undefined {
    return this.sources.get(id);
  }

  get sourceCount(): number {
    return this.sources.size;
  }
}
