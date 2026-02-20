import type { AgentBackendType } from "@agentcraft/shared";
import type { AgentCommunicator } from "./agent-communicator";
import { ClaudeCodeCommunicator } from "./claude-code-communicator";
import { CursorCommunicator } from "./cursor-communicator";

export function createCommunicator(backendType: AgentBackendType): AgentCommunicator {
  switch (backendType) {
    case "claude-code":
      return new ClaudeCodeCommunicator();
    case "cursor":
      return new CursorCommunicator();
    case "custom":
      throw new Error(
        "Custom backend communicator not yet supported. " +
        "Implement AgentCommunicator for your backend.",
      );
  }
}
