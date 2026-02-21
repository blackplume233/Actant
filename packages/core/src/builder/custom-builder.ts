import type { AgentBackendType } from "@agentcraft/shared";
import { CursorBuilder } from "./cursor-builder";

export interface CustomBuilderConfig {
  configDir?: string; // default ".cursor"
  skillsDir?: string; // default ".cursor/rules"
  // Additional overrides...
}

export class CustomBuilder extends CursorBuilder {
  override readonly backendType: AgentBackendType = "custom";

  // CustomBuilder inherits CursorBuilder behavior but with "custom" type
  // Future: use config to customize paths
}
