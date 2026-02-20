import type { AgentLauncher } from "./agent-launcher";
import { MockLauncher } from "./mock-launcher";
import { ProcessLauncher, type ProcessLauncherOptions } from "./process-launcher";

export type LauncherMode = "mock" | "real";

export interface LauncherConfig {
  mode: LauncherMode;
  processOptions?: ProcessLauncherOptions;
}

/**
 * Factory function to create the appropriate AgentLauncher.
 *
 * - "mock": returns MockLauncher (for testing / development without real IDE)
 * - "real": returns ProcessLauncher (spawns actual processes)
 *
 * Default: "real" in production, can be overridden by config or env.
 */
export function createLauncher(config?: Partial<LauncherConfig>): AgentLauncher {
  const mode = config?.mode ?? (process.env.AGENTCRAFT_LAUNCHER_MODE === "mock" ? "mock" : "real");

  switch (mode) {
    case "mock":
      return new MockLauncher();
    case "real":
      return new ProcessLauncher(config?.processOptions);
  }
}
