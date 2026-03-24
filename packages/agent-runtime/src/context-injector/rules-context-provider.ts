import type { AgentInstanceMeta } from "@actant/shared/core";
import type { ContextProvider } from "./session-context-types";

/**
 * Injects template-declared behavioral rules into the Agent's system prompt.
 *
 * Rules are carried on `AgentInstanceMeta.rules` (copied from AgentTemplate
 * at instance creation). Each rule is rendered as a bullet in a `## Rules`
 * section appended to the system context.
 */
export class RulesContextProvider implements ContextProvider {
  readonly name = "rules";

  getSystemContext(_agentName: string, meta: AgentInstanceMeta): string | undefined {
    if (!meta.rules || meta.rules.length === 0) return undefined;

    const lines = meta.rules.map((rule) => `- ${rule}`);
    return `## Rules\n\n${lines.join("\n")}`;
  }
}
