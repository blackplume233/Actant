export interface CanvasEntry {
  agentName: string;
  html: string;
  title?: string;
  updatedAt: number;
}

/**
 * In-memory store for agent canvas HTML content.
 * Each agent can have at most one canvas entry.
 */
export class CanvasStore {
  private entries = new Map<string, CanvasEntry>();

  update(agentName: string, html: string, title?: string): void {
    this.entries.set(agentName, {
      agentName,
      html,
      title,
      updatedAt: Date.now(),
    });
  }

  get(agentName: string): CanvasEntry | undefined {
    return this.entries.get(agentName);
  }

  list(): CanvasEntry[] {
    return Array.from(this.entries.values());
  }

  remove(agentName: string): boolean {
    return this.entries.delete(agentName);
  }
}
