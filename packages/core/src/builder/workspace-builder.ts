import { createLogger } from "@actant/shared";
import type {
  AgentBackendType,
  DomainContextConfig,
  SkillDefinition,
  PromptDefinition,
  WorkflowDefinition,
} from "@actant/shared";
import type { SkillManager } from "../domain/skill/skill-manager";
import type { PromptManager } from "../domain/prompt/prompt-manager";
import type { McpConfigManager } from "../domain/mcp/mcp-config-manager";
import type { WorkflowManager } from "../domain/workflow/workflow-manager";
import type { PluginManager } from "../domain/plugin/plugin-manager";
import type { BackendBuilder, VerifyResult } from "./backend-builder";
import { CursorBuilder } from "./cursor-builder";
import { ClaudeCodeBuilder } from "./claude-code-builder";

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

  constructor(private readonly managers?: DomainManagers) {
    this.builders = new Map<AgentBackendType, BackendBuilder>([
      ["cursor", new CursorBuilder()],
      ["claude-code", new ClaudeCodeBuilder()],
    ]);
  }

  /** Register a custom BackendBuilder (e.g. for "custom" backend type) */
  registerBuilder(builder: BackendBuilder): void {
    this.builders.set(builder.backendType, builder);
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

    const resolved = this.resolveDomainContext(domainContext);

    // Step 2: Validate (log warnings for missing references, don't fail)
    // Already handled by resolve — missing managers use placeholders or empty arrays

    // Step 3: Scaffold
    await activeBuilder.scaffold(workspaceDir);
    logger.debug({ workspaceDir }, "Scaffold complete");

    // Step 4: Materialize
    const tasks: Promise<void>[] = [];

    if (resolved.skills.length > 0) {
      tasks.push(activeBuilder.materializeSkills(workspaceDir, resolved.skills));
    }
    if (resolved.prompts.length > 0) {
      tasks.push(activeBuilder.materializePrompts(workspaceDir, resolved.prompts));
    }
    if (resolved.mcpServers.length > 0) {
      tasks.push(activeBuilder.materializeMcpConfig(workspaceDir, resolved.mcpServers));
    }
    if (resolved.plugins.length > 0) {
      tasks.push(activeBuilder.materializePlugins(workspaceDir, resolved.plugins));
    }
    if (resolved.workflow) {
      tasks.push(activeBuilder.materializeWorkflow(workspaceDir, resolved.workflow));
    }

    await Promise.all(tasks);
    logger.debug({ workspaceDir }, "Materialize complete");

    // Step 5: Inject permissions
    if (resolved.mcpServers.length > 0) {
      await activeBuilder.injectPermissions(workspaceDir, resolved.mcpServers);
      logger.debug({ workspaceDir }, "Permissions injected");
    }

    // Step 6: Verify
    const verify = await activeBuilder.verify(workspaceDir);
    logger.info({ workspaceDir, backendType: activeBuilder.backendType, valid: verify.valid }, "Workspace build complete");

    return { verify, backendType: activeBuilder.backendType };
  }

  private resolveDomainContext(domainContext: DomainContextConfig) {
    // Resolve skills — use manager or placeholder when absent (preserves ContextMaterializer behavior)
    const skills: SkillDefinition[] =
      domainContext.skills?.length && this.managers?.skills
        ? this.managers.skills.resolve(domainContext.skills)
        : (domainContext.skills ?? []).map((name) => ({
            name,
            content: `- ${name}`,
          }));

    // Resolve prompts
    const prompts: PromptDefinition[] =
      domainContext.prompts?.length && this.managers?.prompts
        ? this.managers.prompts.resolve(domainContext.prompts)
        : (domainContext.prompts ?? []).map((name) => ({
            name,
            content: `- ${name}`,
          }));

    // MCP servers come as inline configs (McpServerRef), compatible with McpServerDefinition
    const mcpServers = (domainContext.mcpServers ?? []).map((ref) => ({
      name: ref.name,
      command: ref.command,
      args: ref.args,
      env: ref.env,
    }));

    // Resolve workflow
    let workflow: WorkflowDefinition | undefined;
    if (domainContext.workflow && this.managers?.workflows) {
      const resolved = this.managers.workflows.resolve([domainContext.workflow]);
      workflow = resolved[0];
    } else if (domainContext.workflow) {
      workflow = {
        name: domainContext.workflow,
        content: `# Workflow: ${domainContext.workflow}\n\n> Workflow "${domainContext.workflow}" referenced by name.\n`,
      };
    }

    // Resolve plugins
    const plugins =
      domainContext.plugins?.length && this.managers?.plugins
        ? this.managers.plugins.resolve(domainContext.plugins)
        : [];

    return { skills, prompts, mcpServers, workflow, plugins };
  }
}
