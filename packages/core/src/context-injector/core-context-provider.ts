import type { AgentArchetype, AgentInstanceMeta } from "@actant/shared";
import type { ContextProvider } from "./session-context-injector";
import { loadTemplate, renderTemplate } from "../prompts/template-engine";

const ARCHETYPE_DESCRIPTIONS: Record<AgentArchetype, string> = {
  repo: "repository-scoped agent with minimal platform integration",
  service: "long-running service agent with tool access and canvas capabilities",
  employee: "fully-managed employee agent with all platform capabilities including scheduling",
};

/**
 * Built-in provider that injects the fundamental Actant identity context
 * into every managed agent session, regardless of archetype.
 *
 * Tells the agent what it is, where it lives, and what Actant provides.
 */
export class CoreContextProvider implements ContextProvider {
  readonly name = "core-identity";

  getSystemContext(agentName: string, meta: AgentInstanceMeta): string {
    const template = loadTemplate("core-identity.md");
    return renderTemplate(template, {
      agentName,
      archetype: meta.archetype,
      archetypeDescription: ARCHETYPE_DESCRIPTIONS[meta.archetype] ?? meta.archetype,
      backendType: meta.backendType,
      workspacePolicy: meta.workspacePolicy ?? "persistent",
    }).trim();
  }
}
