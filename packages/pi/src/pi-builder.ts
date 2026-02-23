import { writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
  PluginDefinition,
  PermissionsInput,
} from "@actant/shared";
import { createLogger } from "@actant/shared";
import { resolvePermissions } from "@actant/core";
import type { BackendBuilder, VerifyResult } from "@actant/core";

const logger = createLogger("pi-builder");

export class PiBuilder implements BackendBuilder {
  readonly backendType = "pi" as const;

  async scaffold(workspaceDir: string): Promise<void> {
    await mkdir(join(workspaceDir, ".pi", "skills"), { recursive: true });
    await mkdir(join(workspaceDir, ".pi", "prompts"), { recursive: true });
    await writeFile(join(workspaceDir, "AGENTS.md"), "# Agent Skills\n", "utf-8");
  }

  async materializeSkills(workspaceDir: string, skills: SkillDefinition[]): Promise<void> {
    const skillsDir = join(workspaceDir, ".pi", "skills");
    await mkdir(skillsDir, { recursive: true });
    const sections = skills.map((s) => {
      const header = `## ${s.name}`;
      const desc = s.description ? `\n> ${s.description}\n` : "";
      return `${header}${desc}\n${s.content}`;
    });
    const agentsContent = `# Agent Skills\n\n${sections.join("\n\n---\n\n")}\n`;
    await writeFile(join(workspaceDir, "AGENTS.md"), agentsContent, "utf-8");
    for (const skill of skills) {
      const fileName = `${skill.name.replace(/[/\\]/g, "-")}.md`;
      const content = [
        skill.description ? `> ${skill.description}\n` : "",
        skill.content,
        "",
      ]
        .filter(Boolean)
        .join("\n");
      await writeFile(join(skillsDir, fileName), content, "utf-8");
    }
    logger.debug({ workspaceDir, count: skills.length }, "Skills materialized");
  }

  async materializePrompts(workspaceDir: string, prompts: PromptDefinition[]): Promise<void> {
    const promptsDir = join(workspaceDir, ".pi", "prompts");
    await mkdir(promptsDir, { recursive: true });
    for (const p of prompts) {
      const fileName = `${p.name.replace(/[/\\]/g, "-")}.md`;
      const lines = p.description ? [`> ${p.description}\n`, p.content] : [p.content];
      await writeFile(join(promptsDir, fileName), lines.join("\n") + "\n", "utf-8");
    }
  }

  async materializeMcpConfig(
    _workspaceDir: string,
    servers: McpServerDefinition[],
  ): Promise<void> {
    if (servers.length > 0) {
      logger.warn(
        { serverCount: servers.length },
        "Pi does not support MCP; MCP config will be skipped",
      );
    }
  }

  async materializePlugins(
    _workspaceDir: string,
    _plugins: PluginDefinition[],
  ): Promise<void> {}

  async materializeWorkflow(workspaceDir: string, workflow: WorkflowDefinition): Promise<void> {
    const trellisDir = join(workspaceDir, ".trellis");
    await mkdir(trellisDir, { recursive: true });
    await writeFile(join(trellisDir, "workflow.md"), workflow.content + "\n", "utf-8");
  }

  async injectPermissions(
    workspaceDir: string,
    _servers: McpServerDefinition[],
    permissions?: PermissionsInput,
  ): Promise<void> {
    if (!permissions) return;
    const resolved = resolvePermissions(permissions);
    const tools = resolved.allow ?? [];
    if (tools.length === 0) return;

    const piDir = join(workspaceDir, ".pi");
    await mkdir(piDir, { recursive: true });
    const settings: { tools: string[] } = { tools };
    await writeFile(
      join(piDir, "settings.json"),
      JSON.stringify(settings, null, 2) + "\n",
      "utf-8",
    );
  }

  async verify(workspaceDir: string): Promise<VerifyResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const s = await stat(join(workspaceDir, "AGENTS.md"));
      if (!s.isFile()) {
        errors.push("Expected file: AGENTS.md");
      }
    } catch {
      errors.push("Missing: AGENTS.md");
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
