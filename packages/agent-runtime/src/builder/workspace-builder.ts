import { createLogger } from "@actant/shared/core";
import type {
  AgentBackendType,
  ProjectContextConfig,
  McpServerDefinition,
  PermissionsInput,
} from "@actant/shared/core";
import type { SkillManager, PromptManager, McpConfigManager, WorkflowManager, PluginManager } from "@actant/domain-context";
import type { BackendManager } from "../domain/backend/backend-manager";
import type { BackendBuilder, VerifyResult } from "./backend-builder";
import type { ComponentTypeHandler, NamedComponent, ResolvableComponentCollection } from "./component-type-handler";
import { CursorBuilder } from "./cursor-builder";
import { ClaudeCodeBuilder } from "./claude-code-builder";
import { DeclarativeBuilder } from "./declarative-builder";
import { getBackendManager } from "../manager/launcher/backend-registry";
import {
  skillsHandler,
  promptsHandler,
  mcpServersHandler,
  workflowHandler,
  pluginsHandler,
} from "./handlers";

const logger = createLogger("workspace-builder");

export interface ProjectComponentManagers {
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

export interface WorkspaceBuilderOptions {
  backendManager?: BackendManager;
}

export class WorkspaceBuilder {
  private readonly builders: Map<AgentBackendType, BackendBuilder>;
  private readonly handlers: ComponentTypeHandler[] = [];
  private readonly backendManager: BackendManager;

  constructor(
    private readonly managers?: ProjectComponentManagers,
    options?: WorkspaceBuilderOptions,
  ) {
    this.backendManager = options?.backendManager ?? getBackendManager();
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

  private getManager(contextKey: string): ResolvableComponentCollection<NamedComponent> | undefined {
    const managerMap: Record<string, ResolvableComponentCollection<NamedComponent> | undefined> = {
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
   * 1. Resolve — select builder + resolve project resource names to definitions
   * 2. Validate — check that required components exist
   * 3. Scaffold — create directory structure
   * 4. Materialize — write component files
   * 5. Inject — set up permissions
   * 6. Verify — check workspace integrity
   */
  async build(
    workspaceDir: string,
    project: ProjectContextConfig,
    backendType: AgentBackendType = "cursor",
    permissions?: PermissionsInput,
  ): Promise<WorkspaceBuildResult> {
    // Step 1: Resolve builder — check local registry, then BackendManager materialization specs
    let builder = this.builders.get(backendType);
    if (!builder) {
      const registeredBuilder = this.backendManager.getBuilder(backendType) as BackendBuilder | undefined;
      if (registeredBuilder) {
        builder = registeredBuilder;
      } else {
        const def = this.backendManager.get(backendType);
        if (def?.materialization) {
          builder = new DeclarativeBuilder(backendType, def.materialization);
          logger.debug({ backendType }, "Created DeclarativeBuilder from MaterializationSpec");
        }
      }
    }
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
      const refs = project[handler.contextKey as keyof ProjectContextConfig];
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

    if (project.extensions) {
      for (const [key, refs] of Object.entries(project.extensions)) {
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
