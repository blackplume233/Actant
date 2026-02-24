import type { AgentBackendType } from "@actant/shared";
import type { AgentCommunicator } from "./agent-communicator";
import { ClaudeCodeCommunicator } from "./claude-code-communicator";
import { CursorCommunicator } from "./cursor-communicator";

const registry = new Map<AgentBackendType, (backendConfig?: Record<string, unknown>) => AgentCommunicator>();

/**
 * Register a communicator factory for a backend type.
 * External packages (e.g. @actant/pi) call this at startup.
 * The factory receives the template's `backend.config` so it can extract
 * provider-specific settings (provider, model, apiKey, etc.).
 */
export function registerCommunicator(
  backendType: AgentBackendType,
  factory: (backendConfig?: Record<string, unknown>) => AgentCommunicator,
): void {
  registry.set(backendType, factory);
}

export function createCommunicator(
  backendType: AgentBackendType,
  backendConfig?: Record<string, unknown>,
): AgentCommunicator {
  const registered = registry.get(backendType);
  if (registered) return registered(backendConfig);

  switch (backendType) {
    case "claude-code":
      return new ClaudeCodeCommunicator();
    case "cursor":
    case "cursor-agent":
      return new CursorCommunicator();
    default:
      throw new Error(
        `No communicator registered for backend "${backendType}". ` +
        `Register one via registerCommunicator() at startup.`,
      );
  }
}
