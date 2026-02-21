import { writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgentBackendType,
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
  PluginDefinition,
} from "@agentcraft/shared";
import { createLogger } from "@agentcraft/shared";
import type { BackendBuilder, VerifyResult } from "./backend-builder";

const logger = createLogger("cursor-builder");

export class CursorBuilder implements BackendBuilder {
  readonly backendType: AgentBackendType = "cursor";

  async scaffold(workspaceDir: string): Promise<void> {
    await mkdir(join(workspaceDir, ".cursor", "rules"), { recursive: true });
    await mkdir(join(workspaceDir, "prompts"), { recursive: true });
    await writeFile(join(workspaceDir, "AGENTS.md"), "# Agent Skills\n", "utf-8");
  }

  async materializeSkills(workspaceDir: string, skills: SkillDefinition[]): Promise<void> {
    const rulesDir = join(workspaceDir, ".cursor", "rules");
    for (const skill of skills) {
      const fileName = `${skill.name.replace(/[/\\]/g, "-")}.mdc`;
      const content = [
        "---",
        `description: "${(skill.description ?? skill.name).replace(/"/g, '\\"')}"`,
        "alwaysApply: true",
        "---",
        "",
        skill.content,
        "",
      ].join("\n");
      await writeFile(join(rulesDir, fileName), content, "utf-8");
    }
    const sections = skills.map((s) => {
      const header = `## ${s.name}`;
      const desc = s.description ? `\n> ${s.description}\n` : "";
      return `${header}${desc}\n${s.content}`;
    });
    const agentsContent = `# Agent Skills\n\n${sections.join("\n\n---\n\n")}\n`;
    await writeFile(join(workspaceDir, "AGENTS.md"), agentsContent, "utf-8");
    logger.debug({ workspaceDir, count: skills.length }, "Skills materialized");
  }

  async materializePrompts(workspaceDir: string, prompts: PromptDefinition[]): Promise<void> {
    const content = prompts
      .map((p) => {
        const lines = [`## ${p.name}`];
        if (p.description) lines.push(`\n> ${p.description}\n`);
        lines.push("", p.content);
        return lines.join("\n");
      })
      .join("\n\n---\n\n");
    await writeFile(join(workspaceDir, "prompts", "system.md"), content + "\n", "utf-8");
  }

  async materializeMcpConfig(workspaceDir: string, servers: McpServerDefinition[]): Promise<void> {
    const configDir = join(workspaceDir, ".cursor");
    await mkdir(configDir, { recursive: true });

    const mcpConfig: Record<
      string,
      { command: string; args: string[]; env?: Record<string, string> }
    > = {};
    for (const server of servers) {
      mcpConfig[server.name] = {
        command: server.command,
        args: server.args ?? [],
        ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
      };
    }
    await writeFile(
      join(configDir, "mcp.json"),
      JSON.stringify({ mcpServers: mcpConfig }, null, 2) + "\n",
      "utf-8",
    );
  }

  async materializePlugins(workspaceDir: string, plugins: PluginDefinition[]): Promise<void> {
    const npmPlugins = plugins.filter((p) => p.enabled !== false && p.type === "npm");
    if (npmPlugins.length === 0) return;

    const configDir = join(workspaceDir, ".cursor");
    await mkdir(configDir, { recursive: true });
    const recommendations = npmPlugins.map((p) => p.source ?? p.name);
    await writeFile(
      join(configDir, "extensions.json"),
      JSON.stringify({ recommendations }, null, 2) + "\n",
      "utf-8",
    );
  }

  async materializeWorkflow(workspaceDir: string, workflow: WorkflowDefinition): Promise<void> {
    const trellisDir = join(workspaceDir, ".trellis");
    await mkdir(trellisDir, { recursive: true });
    await writeFile(join(trellisDir, "workflow.md"), workflow.content + "\n", "utf-8");
  }

  async injectPermissions(
    _workspaceDir: string,
    _servers: McpServerDefinition[],
  ): Promise<void> {
    // Cursor handles permissions via its own UI, no file injection needed
  }

  async verify(workspaceDir: string): Promise<VerifyResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const checks = [
      { path: ".cursor", type: "dir" as const },
      { path: "AGENTS.md", type: "file" as const },
    ];

    for (const check of checks) {
      try {
        const s = await stat(join(workspaceDir, check.path));
        if (check.type === "dir" && !s.isDirectory()) {
          errors.push(`Expected directory: ${check.path}`);
        } else if (check.type === "file" && !s.isFile()) {
          errors.push(`Expected file: ${check.path}`);
        }
      } catch {
        warnings.push(`Missing: ${check.path}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
