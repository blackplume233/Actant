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
import type { BackendBuilder, VerifyResult } from "./backend-builder";
import { resolvePermissionsWithMcp } from "../permissions/permission-presets";

const logger = createLogger("claude-code-builder");

export class ClaudeCodeBuilder implements BackendBuilder {
  readonly backendType = "claude-code" as const;

  async scaffold(workspaceDir: string): Promise<void> {
    await mkdir(join(workspaceDir, ".claude"), { recursive: true });
    await mkdir(join(workspaceDir, "prompts"), { recursive: true });
  }

  async materializeSkills(workspaceDir: string, skills: SkillDefinition[]): Promise<void> {
    const sections = skills.map((s) => {
      const header = `## ${s.name}`;
      const desc = s.description ? `\n> ${s.description}\n` : "";
      return `${header}${desc}\n${s.content}`;
    });
    const agentsContent = `# Agent Skills\n\n${sections.join("\n\n---\n\n")}\n`;
    await writeFile(join(workspaceDir, "AGENTS.md"), agentsContent, "utf-8");

    const claudeContent = `# Claude Code Skills\n\n${sections.join("\n\n---\n\n")}\n`;
    await writeFile(join(workspaceDir, "CLAUDE.md"), claudeContent, "utf-8");
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
    const configDir = join(workspaceDir, ".claude");
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
    const enabledPlugins = plugins.filter((p) => p.enabled !== false);
    if (enabledPlugins.length === 0) return;

    const configDir = join(workspaceDir, ".claude");
    await mkdir(configDir, { recursive: true });
    const entries = enabledPlugins.map((p) => {
      if (p.type === "npm") {
        return { name: p.name, package: p.source ?? p.name, ...p.config };
      }
      return { name: p.name, type: p.type, source: p.source, ...p.config };
    });
    await writeFile(
      join(configDir, "plugins.json"),
      JSON.stringify(entries, null, 2) + "\n",
      "utf-8",
    );
  }

  async materializeWorkflow(workspaceDir: string, workflow: WorkflowDefinition): Promise<void> {
    const trellisDir = join(workspaceDir, ".trellis");
    await mkdir(trellisDir, { recursive: true });
    await writeFile(join(trellisDir, "workflow.md"), workflow.content + "\n", "utf-8");
  }

  async injectPermissions(
    workspaceDir: string,
    servers: McpServerDefinition[],
    permissions?: PermissionsInput,
  ): Promise<void> {
    const configDir = join(workspaceDir, ".claude");
    await mkdir(configDir, { recursive: true });

    const resolved = resolvePermissionsWithMcp(
      permissions,
      servers.map((s) => s.name),
    );

    const settings: Record<string, unknown> = {
      permissions: {
        allow: resolved.allow ?? [],
        deny: resolved.deny ?? [],
        ask: resolved.ask ?? [],
      },
    };
    if (resolved.sandbox) {
      settings.sandbox = resolved.sandbox;
    }
    await writeFile(
      join(configDir, "settings.local.json"),
      JSON.stringify(settings, null, 2) + "\n",
      "utf-8",
    );
  }

  async verify(workspaceDir: string): Promise<VerifyResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const checks = [
      { path: ".claude", type: "dir" as const },
      { path: "AGENTS.md", type: "file" as const },
      { path: "CLAUDE.md", type: "file" as const },
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
