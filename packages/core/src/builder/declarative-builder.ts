import { writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgentBackendType,
  MaterializationSpec,
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

const logger = createLogger("declarative-builder");

/**
 * A generic BackendBuilder driven entirely by a MaterializationSpec.
 * No hand-written builder class needed — the spec declares how each
 * component type is materialized.
 */
export class DeclarativeBuilder implements BackendBuilder {
  readonly backendType: AgentBackendType;

  constructor(
    backendType: AgentBackendType,
    private readonly spec: MaterializationSpec,
  ) {
    this.backendType = backendType;
  }

  async scaffold(workspaceDir: string): Promise<void> {
    await mkdir(join(workspaceDir, this.spec.configDir), { recursive: true });

    if (this.spec.scaffoldDirs) {
      for (const dir of this.spec.scaffoldDirs) {
        await mkdir(join(workspaceDir, dir), { recursive: true });
      }
    }

    if (this.spec.components.skills?.mode === "single-file" || this.spec.components.skills?.mode === "dual") {
      await writeFile(join(workspaceDir, "AGENTS.md"), "# Agent Skills\n", "utf-8");
    }
  }

  async materializeSkills(workspaceDir: string, skills: SkillDefinition[]): Promise<void> {
    const strategy = this.spec.components.skills;
    if (!strategy) return;

    const sections = skills.map((s) => {
      const header = `## ${s.name}`;
      const desc = s.description ? `\n> ${s.description}\n` : "";
      return `${header}${desc}\n${s.content}`;
    });

    if (strategy.mode === "single-file" || strategy.mode === "dual") {
      const agentsContent = `# Agent Skills\n\n${sections.join("\n\n---\n\n")}\n`;
      await writeFile(join(workspaceDir, "AGENTS.md"), agentsContent, "utf-8");
    }

    if (strategy.mode === "per-file" || strategy.mode === "dual") {
      const outputDir = strategy.outputDir
        ? join(workspaceDir, strategy.outputDir)
        : join(workspaceDir, this.spec.configDir, "skills");
      await mkdir(outputDir, { recursive: true });
      const ext = strategy.extension ?? ".md";

      for (const skill of skills) {
        const fileName = `${skill.name.replace(/[/\\]/g, "-")}${ext}`;
        let content: string;

        if (strategy.frontmatterTemplate) {
          const desc = (skill.description ?? skill.name).replace(/"/g, '\\"');
          const frontmatter = strategy.frontmatterTemplate.replace("{{description}}", desc);
          content = `---\n${frontmatter}\n---\n\n${skill.content}\n`;
        } else {
          const parts = skill.description ? [`> ${skill.description}\n`, skill.content] : [skill.content];
          content = parts.filter(Boolean).join("\n") + "\n";
        }

        await writeFile(join(outputDir, fileName), content, "utf-8");
      }
    }

    if (strategy.aggregateFiles) {
      for (const agg of strategy.aggregateFiles) {
        const aggContent = agg.format === "claude-md"
          ? `# Claude Code Skills\n\n${sections.join("\n\n---\n\n")}\n`
          : `# Agent Skills\n\n${sections.join("\n\n---\n\n")}\n`;
        await writeFile(join(workspaceDir, agg.path), aggContent, "utf-8");
      }
    }

    logger.debug({ workspaceDir, count: skills.length, mode: strategy.mode }, "Skills materialized");
  }

  async materializePrompts(workspaceDir: string, prompts: PromptDefinition[]): Promise<void> {
    const strategy = this.spec.components.prompts;
    if (!strategy) return;

    if (strategy.mode === "merged") {
      const content = prompts
        .map((p) => {
          const lines = [`## ${p.name}`];
          if (p.description) lines.push(`\n> ${p.description}\n`);
          lines.push("", p.content);
          return lines.join("\n");
        })
        .join("\n\n---\n\n");
      const outPath = join(workspaceDir, strategy.output);
      await mkdir(join(outPath, ".."), { recursive: true });
      await writeFile(outPath, content + "\n", "utf-8");
    } else {
      const outDir = join(workspaceDir, strategy.output);
      await mkdir(outDir, { recursive: true });
      for (const p of prompts) {
        const fileName = `${p.name.replace(/[/\\]/g, "-")}.md`;
        const lines = p.description ? [`> ${p.description}\n`, p.content] : [p.content];
        await writeFile(join(outDir, fileName), lines.join("\n") + "\n", "utf-8");
      }
    }
  }

  async materializeMcpConfig(workspaceDir: string, servers: McpServerDefinition[]): Promise<void> {
    const strategy = this.spec.components.mcpServers;
    if (!strategy || !strategy.enabled) {
      if (servers.length > 0) {
        logger.warn({ serverCount: servers.length, backendType: this.backendType }, "MCP config skipped (not supported by this backend)");
      }
      return;
    }

    const outputFile = strategy.outputFile ?? join(this.spec.configDir, "mcp.json");
    const outPath = join(workspaceDir, outputFile);
    await mkdir(join(outPath, ".."), { recursive: true });

    const mcpConfig: Record<string, { command: string; args: string[]; env?: Record<string, string> }> = {};
    for (const server of servers) {
      mcpConfig[server.name] = {
        command: server.command,
        args: server.args ?? [],
        ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
      };
    }
    await writeFile(outPath, JSON.stringify({ mcpServers: mcpConfig }, null, 2) + "\n", "utf-8");
  }

  async materializePlugins(workspaceDir: string, plugins: PluginDefinition[]): Promise<void> {
    const strategy = this.spec.components.plugins;
    if (!strategy || !strategy.enabled) return;

    const enabledPlugins = plugins.filter((p) => p.enabled !== false);
    if (enabledPlugins.length === 0) return;

    const outputFile = strategy.outputFile ?? join(this.spec.configDir, "plugins.json");
    const outPath = join(workspaceDir, outputFile);
    await mkdir(join(outPath, ".."), { recursive: true });

    let content: unknown;
    if (strategy.format === "recommendations") {
      const recommendations = enabledPlugins
        .filter((p) => p.type === "npm")
        .map((p) => p.source ?? p.name);
      content = { recommendations };
    } else {
      content = enabledPlugins.map((p) => {
        if (p.type === "npm") {
          return { name: p.name, package: p.source ?? p.name, ...p.config };
        }
        return { name: p.name, type: p.type, source: p.source, ...p.config };
      });
    }
    await writeFile(outPath, JSON.stringify(content, null, 2) + "\n", "utf-8");
  }

  async materializeWorkflow(workspaceDir: string, workflow: WorkflowDefinition): Promise<void> {
    const strategy = this.spec.components.workflow;
    if (!strategy) return;

    const outPath = join(workspaceDir, strategy.outputFile);
    await mkdir(join(outPath, ".."), { recursive: true });
    await writeFile(outPath, workflow.content + "\n", "utf-8");
  }

  async injectPermissions(
    workspaceDir: string,
    servers: McpServerDefinition[],
    permissions?: PermissionsInput,
  ): Promise<void> {
    const strategy = this.spec.components.permissions;
    if (!strategy || !permissions) return;

    const resolved = resolvePermissionsWithMcp(
      permissions,
      servers.map((s) => s.name),
    );

    const outPath = join(workspaceDir, strategy.outputFile);
    await mkdir(join(outPath, ".."), { recursive: true });

    let settings: Record<string, unknown> | undefined;

    switch (strategy.mode) {
      case "full":
        settings = {
          permissions: {
            allow: resolved.allow ?? [],
            deny: resolved.deny ?? [],
            ask: resolved.ask ?? [],
          },
        };
        if (resolved.sandbox) {
          settings["sandbox"] = resolved.sandbox;
        }
        break;

      case "tools-only":
        settings = { tools: resolved.allow ?? [] };
        break;

      case "best-effort":
        if (!resolved.allow?.length) return;
        settings = { agentTools: { allow: resolved.allow } };
        break;
    }

    if (!settings) return;
    await writeFile(outPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  }

  async verify(workspaceDir: string): Promise<VerifyResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const checks = this.spec.verifyChecks ?? [
      { path: this.spec.configDir, type: "dir" as const, severity: "warning" as const },
      { path: "AGENTS.md", type: "file" as const, severity: "warning" as const },
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
        const severity = check.severity ?? "warning";
        if (severity === "error") {
          errors.push(`Missing: ${check.path}`);
        } else {
          warnings.push(`Missing: ${check.path}`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
