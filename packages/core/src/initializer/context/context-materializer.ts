import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { DomainContextConfig, McpServerRef } from "@actant/shared";
import type { AgentBackendType } from "@actant/shared";
import { createLogger } from "@actant/shared";
import type { SkillManager } from "../../domain/skill/skill-manager";
import type { PromptManager } from "../../domain/prompt/prompt-manager";
import type { McpConfigManager } from "../../domain/mcp/mcp-config-manager";
import type { WorkflowManager } from "../../domain/workflow/workflow-manager";

const logger = createLogger("context-materializer");

/** Config directory per backend: Cursor uses .cursor, Claude Code uses .claude (hooks/MCP go here). */
const BACKEND_CONFIG_DIR: Record<AgentBackendType, string> = {
  cursor: ".cursor",
  "claude-code": ".claude",
  custom: ".cursor",
};

/**
 * Optional Domain managers for full component resolution.
 * When provided, names are resolved to real definitions and rendered.
 * When absent, placeholder content is generated.
 */
export interface DomainManagers {
  skills?: SkillManager;
  prompts?: PromptManager;
  mcp?: McpConfigManager;
  workflows?: WorkflowManager;
}

/**
 * Materializes Domain Context references into actual files in the instance workspace.
 * Paths for IDE-specific config (MCP, etc.) depend on backendType (e.g. .cursor vs .claude).
 *
 * Materialization rules:
 *   skills      → AGENTS.md
 *   mcpServers  → {backendConfigDir}/mcp.json (e.g. .cursor/mcp.json or .claude/mcp.json)
 *   workflow    → .trellis/workflow.md
 *   prompts     → prompts/system.md
 *   subAgents   → recorded in .actant.json (not materialized as files)
 *
 * @deprecated Use WorkspaceBuilder + BackendBuilder instead (Phase 3b).
 * Kept for backward compatibility; will be removed in a future version.
 */
export class ContextMaterializer {
  constructor(private readonly managers?: DomainManagers) {}

  async materialize(
    workspaceDir: string,
    domainContext: DomainContextConfig,
    backendType: AgentBackendType = "cursor",
  ): Promise<void> {
    const configDir = BACKEND_CONFIG_DIR[backendType];
    const tasks: Promise<void>[] = [];

    if (domainContext.skills && domainContext.skills.length > 0) {
      tasks.push(this.materializeSkills(workspaceDir, domainContext.skills));
    }

    if (domainContext.mcpServers && domainContext.mcpServers.length > 0) {
      tasks.push(this.materializeMcpServers(workspaceDir, domainContext.mcpServers, configDir));

      if (backendType === "claude-code") {
        tasks.push(this.materializeClaudePermissions(workspaceDir, domainContext.mcpServers, configDir));
      }
    }

    if (domainContext.workflow) {
      tasks.push(this.materializeWorkflow(workspaceDir, domainContext.workflow));
    }

    if (domainContext.prompts && domainContext.prompts.length > 0) {
      tasks.push(this.materializePrompts(workspaceDir, domainContext.prompts));
    }

    await Promise.all(tasks);
    logger.debug({ workspaceDir, backendType, configDir }, "Domain context materialized");
  }

  private async materializeSkills(workspaceDir: string, skillNames: string[]): Promise<void> {
    let content: string;
    if (this.managers?.skills) {
      const resolved = this.managers.skills.resolve(skillNames);
      content = this.managers.skills.renderSkills(resolved);
    } else {
      content = [
        "# Agent Skills",
        "",
        ...skillNames.map((s) => `- ${s}`),
        "",
      ].join("\n");
    }
    await writeFile(join(workspaceDir, "AGENTS.md"), content, "utf-8");
  }

  /**
   * MCP Servers → {configDir}/mcp.json (e.g. .cursor/mcp.json or .claude/mcp.json)
   * Template provides inline McpServerRef configs; no name-based resolution needed.
   */
  private async materializeMcpServers(
    workspaceDir: string,
    servers: McpServerRef[],
    configDirName: string,
  ): Promise<void> {
    const configDir = join(workspaceDir, configDirName);
    await mkdir(configDir, { recursive: true });

    const mcpConfig: Record<string, { command: string; args: string[]; env?: Record<string, string> }> = {};
    for (const server of servers) {
      mcpConfig[server.name] = {
        command: server.command,
        args: server.args ?? [],
        ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
      };
    }

    const config = { mcpServers: mcpConfig };
    await writeFile(
      join(configDir, "mcp.json"),
      JSON.stringify(config, null, 2) + "\n",
      "utf-8",
    );
  }

  /**
   * Claude Code settings.local.json — pre-approve tools so agents can operate autonomously.
   * Includes both MCP tools (`mcp__<server>` prefix) and essential built-in tools.
   */
  private async materializeClaudePermissions(
    workspaceDir: string,
    servers: McpServerRef[],
    configDirName: string,
  ): Promise<void> {
    const configDir = join(workspaceDir, configDirName);
    await mkdir(configDir, { recursive: true });

    const allowedTools: string[] = [
      "Bash",
      "Read",
      "Write",
      "Edit",
      "MultiEdit",
      "WebFetch",
      "WebSearch",
    ];
    for (const server of servers) {
      allowedTools.push(`mcp__${server.name}`);
    }

    const settings = {
      permissions: {
        allow: allowedTools,
        deny: [],
      },
    };
    await writeFile(
      join(configDir, "settings.local.json"),
      JSON.stringify(settings, null, 2) + "\n",
      "utf-8",
    );
  }

  private async materializeWorkflow(workspaceDir: string, workflowName: string): Promise<void> {
    const trellisDir = join(workspaceDir, ".trellis");
    await mkdir(trellisDir, { recursive: true });

    let content: string;
    if (this.managers?.workflows) {
      const resolved = this.managers.workflows.resolve([workflowName]);
      const workflow = resolved[0];
      content = workflow
        ? this.managers.workflows.renderWorkflow(workflow)
        : `# Workflow: ${workflowName}\n\n> Workflow "${workflowName}" not resolved.\n`;
    } else {
      content = [
        `# Workflow: ${workflowName}`,
        "",
        `> Workflow "${workflowName}" referenced by name.`,
        "",
      ].join("\n");
    }
    await writeFile(join(trellisDir, "workflow.md"), content, "utf-8");
  }

  private async materializePrompts(workspaceDir: string, promptNames: string[]): Promise<void> {
    const promptsDir = join(workspaceDir, "prompts");
    await mkdir(promptsDir, { recursive: true });

    let content: string;
    if (this.managers?.prompts) {
      const resolved = this.managers.prompts.resolve(promptNames);
      content = this.managers.prompts.renderPrompts(resolved);
    } else {
      content = [
        "# System Prompts",
        "",
        ...promptNames.map((p) => `- ${p}`),
        "",
      ].join("\n");
    }
    await writeFile(join(promptsDir, "system.md"), content, "utf-8");
  }
}
