import type { VfsMountRegistration, VfsLifecycle } from "@actant/shared";
import { createDomainSource } from "@actant/vfs";
import type { ContextSource, ContextSourceType } from "../types";

/**
 * Minimal interface required from a domain component manager.
 * All Actant managers (SkillManager, PromptManager, McpConfigManager,
 * WorkflowManager, TemplateRegistry) satisfy this contract via
 * BaseComponentManager.
 */
export interface DomainComponentManager {
  list(): MinimalDomainComponent[];
  get(name: string): MinimalDomainComponent | undefined;
  search(query: string): MinimalDomainComponent[];
}

export interface MinimalDomainComponent {
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
}

/**
 * Named references to the domain managers that DomainContextSource wraps.
 * All fields are optional — missing managers are simply not projected.
 */
export interface DomainManagers {
  skillManager?: DomainComponentManager;
  promptManager?: DomainComponentManager;
  mcpConfigManager?: DomainComponentManager;
  workflowManager?: DomainComponentManager;
  templateRegistry?: DomainComponentManager;
}

/**
 * Standard mount path layout for domain context.
 * Overridable per-instance, but defaults provided.
 */
export interface DomainMountLayout {
  skills: string;
  prompts: string;
  mcp: string;
  workflows: string;
  templates: string;
}

const DEFAULT_LAYOUT: DomainMountLayout = {
  skills: "/skills",
  prompts: "/prompts",
  mcp: "/mcp",
  workflows: "/workflows",
  templates: "/templates",
};

/**
 * A ContextSource that wraps domain component managers (Skills, Prompts,
 * MCP configs, Workflows, Templates) and projects them into VFS mounts.
 *
 * Each manager is projected as a separate VFS mount point using the
 * existing `createDomainSource` utility from @actant/vfs.
 *
 * VFS layout:
 * ```
 * /skills/
 * ├── ue5-blueprint         → full skill content
 * ├── _catalog.json         → all skills summary
 * /prompts/
 * ├── review-prompt         → full prompt content
 * ├── _catalog.json         → all prompts summary
 * /mcp/
 * ├── unreal-hub            → MCP config as JSON
 * ├── _catalog.json         → all MCP servers summary
 * /workflows/
 * ├── code-review-flow      → full workflow content
 * ├── _catalog.json         → all workflows summary
 * /templates/
 * ├── code-reviewer         → template JSON
 * └── _catalog.json         → all templates summary
 * ```
 */
export interface DomainContextSourceOptions {
  name?: string;
  lifecycle?: VfsLifecycle;
  layout?: Partial<DomainMountLayout>;
}

export class DomainContextSource implements ContextSource {
  readonly name: string;
  readonly type: ContextSourceType = "domain";

  private readonly managers: DomainManagers;
  private readonly lifecycle: VfsLifecycle;
  private readonly layout: DomainMountLayout;

  constructor(
    managers: DomainManagers,
    options?: DomainContextSourceOptions,
  ) {
    this.name = options?.name ?? "domain";
    this.managers = managers;
    this.lifecycle = options?.lifecycle ?? { type: "daemon" };
    this.layout = { ...DEFAULT_LAYOUT, ...options?.layout };
  }

  toVfsMounts(mountPrefix: string): VfsMountRegistration[] {
    const registrations: VfsMountRegistration[] = [];
    const prefix = mountPrefix || "";

    const entries: Array<{
      manager: DomainComponentManager | undefined;
      domain: string;
      path: string;
    }> = [
      { manager: this.managers.skillManager, domain: "skill", path: this.layout.skills },
      { manager: this.managers.promptManager, domain: "prompt", path: this.layout.prompts },
      { manager: this.managers.mcpConfigManager, domain: "mcp", path: this.layout.mcp },
      { manager: this.managers.workflowManager, domain: "workflow", path: this.layout.workflows },
      { manager: this.managers.templateRegistry, domain: "template", path: this.layout.templates },
    ];

    for (const entry of entries) {
      if (!entry.manager) continue;
      registrations.push(
        createDomainSource(
          entry.manager,
          `domain-${entry.domain}`,
          `${prefix}${entry.path}`,
          this.lifecycle,
        ),
      );
    }

    return registrations;
  }
}
