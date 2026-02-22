import { createLogger } from "@actant/shared";
import type {
  AgentBackendType,
  DomainContextConfig,
  McpServerDefinition,
  PermissionsInput,
} from "@actant/shared";
import type { SkillManager } from "../domain/skill/skill-manager";
import type { PromptManager } from "../domain/prompt/prompt-manager";
import type { McpConfigManager } from "../domain/mcp/mcp-config-manager";
import type { WorkflowManager } from "../domain/workflow/workflow-manager";
import type { PluginManager } from "../domain/plugin/plugin-manager";
import type { BaseComponentManager, NamedComponent } from "../domain/base-component-manager";
import type { BackendBuilder, VerifyResult } from "./backend-builder";
import type { ComponentTypeHandler } from "./component-type-handler";
import { CursorBuilder } from "./cursor-builder";
import { ClaudeCodeBuilder } from "./claude-code-builder";
import {
  skillsHandler,
  promptsHandler,
  mcpServersHandler,
  workflowHandler,
  pluginsHandler,
} from "./handlers";

const logger = createLogger("workspace-builder");

export interface DomainManagers {
  skills?: SkillManager;
  prompts?: PromptManager;
  mcp?: McpConfigManager;
  workflows?: WorkflowManager;
  plugins?: PluginManager;
}

export interface WorkspaceBuildResult {
  verify: VerifyResult;
  backendType: AgentBackendType;
}

export class WorkspaceBuilder {
  private readonly builders: Map<AgentBackendType, BackendBuilder>;
  private readonly handlers: ComponentTypeHandler[] = [];

  constructor(private readonly managers?: DomainManagers) {
    this.builders = new Map<AgentBackendType, BackendBuilder>([
      ["cursor", new CursorBuilder()],
      ["claude-code", new ClaudeCodeBuilder()],
    ]);
    this.handlers.push(skillsHandler, promptsHandler, mcpServersHandler, workflowHandler, pluginsHandler);
  }

  /** Register a custom BackendBuilder (e.g. for "custom" backend type) */
  registerBuilder(builder: BackendBuilder): void {
    this.builders.set(builder.backendType, builder);
  }

  /** Register a component type handler for custom component types or extensions */
  registerHandler(handler: ComponentTypeHandler): void {
    this.handlers.push(handler);
  }

  private getManager(contextKey: string): BaseComponentManager<NamedComponent> | undefined {
    const managerMap: Record<string, BaseComponentManager<NamedComponent> | undefined> = {
      skills: this.managers?.skills,
      prompts: this.managers?.prompts,
      mcpServers: this.managers?.mcp,
      workflow: this.managers?.workflows,
      plugins: this.managers?.plugins,
    };
    return managerMap[contextKey];
  }

  /**
   * Build workspace using the 6-step pipeline:
   * 1. Resolve — select builder + resolve domain context names to definitions
   * 2. Validate — check that required components exist
   * 3. Scaffold — create directory structure
   * 4. Materialize — write component files
   * 5. Inject — set up permissions
   * 6. Verify — check workspace integrity
   */
  async build(
    workspaceDir: string,
    domainContext: DomainContextConfig,
    backendType: AgentBackendType = "cursor",
    permissions?: PermissionsInput,
  ): Promise<WorkspaceBuildResult> {
    // Step 1: Resolve
    let builder = this.builders.get(backendType);
    if (!builder) {
      logger.warn({ backendType }, "No builder registered, falling back to cursor");
      builder = this.builders.get("cursor");
    }
    if (!builder) {
      throw new Error(`No builder available for backend type: ${backendType}`);
    }
    const activeBuilder = builder;

    // Step 2: Validate (log warnings for missing references, don't fail)
    // Already handled by resolve — missing managers use placeholders or empty arrays

    // Step 3: Scaffold
    await activeBuilder.scaffold(workspaceDir);
    logger.debug({ workspaceDir }, "Scaffold complete");

    // Step 4: Materialize via registered handlers
    let resolvedMcpServers: McpServerDefinition[] = [];

    for (const handler of this.handlers) {
      const refs = domainContext[handler.contextKey as keyof DomainContextConfig];
      if (refs === undefined || refs === null) continue;
      if (Array.isArray(refs) && refs.length === 0) continue;

      const manager = this.getManager(handler.contextKey);
      const definitions = handler.resolve(refs, manager);
      if (definitions.length > 0) {
        await handler.materialize(workspaceDir, definitions, backendType, activeBuilder);
        if (handler.contextKey === "mcpServers") {
          resolvedMcpServers = definitions as McpServerDefinition[];
        }
      }
    }

    if (domainContext.extensions) {
      for (const [key, refs] of Object.entries(domainContext.extensions)) {
        const handler = this.handlers.find((h) => h.contextKey === key);
        if (handler && Array.isArray(refs) && refs.length > 0) {
          const defs = handler.resolve(refs, this.getManager(key));
          if (defs.length > 0) {
            await handler.materialize(workspaceDir, defs, backendType, activeBuilder);
            if (handler.contextKey === "mcpServers") {
              resolvedMcpServers = [...resolvedMcpServers, ...(defs as McpServerDefinition[])];
            }
          }
        }
      }
    }

    logger.debug({ workspaceDir }, "Materialize complete");

    // Step 5: Inject permissions
    await activeBuilder.injectPermissions(workspaceDir, resolvedMcpServers, permissions);
    logger.debug({ workspaceDir }, "Permissions injected");

    // Step 6: Verify
    const verify = await activeBuilder.verify(workspaceDir);
    logger.info({ workspaceDir, backendType: activeBuilder.backendType, valid: verify.valid }, "Workspace build complete");

    return { verify, backendType: activeBuilder.backendType };
  }
}
