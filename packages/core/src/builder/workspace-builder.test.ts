import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DomainContextConfig } from "@actant/shared";
import {
  SkillManager,
  PromptManager,
  WorkflowManager,
  PluginManager,
} from "../domain/index";
import { WorkspaceBuilder, CustomBuilder } from "./index";

describe("WorkspaceBuilder", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-workspace-builder-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("build() with cursor backend", () => {
    it("creates correct files for cursor backend", async () => {
      const builder = new WorkspaceBuilder();
      const domainContext: DomainContextConfig = {
        skills: ["skill-a", "skill-b"],
        prompts: ["system-prompt"],
        mcpServers: [{ name: "fs", command: "npx", args: ["-y", "mcp-fs"] }],
        workflow: "standard",
      };

      const result = await builder.build(tmpDir, domainContext, "cursor");

      expect(result.backendType).toBe("cursor");
      expect(result.verify.valid).toBe(true);

      const agentsContent = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
      expect(agentsContent).toContain("skill-a");
      expect(agentsContent).toContain("skill-b");

      const mcpRaw = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
      const mcp = JSON.parse(mcpRaw);
      expect(mcp.mcpServers.fs.command).toBe("npx");
      expect(mcp.mcpServers.fs.args).toEqual(["-y", "mcp-fs"]);

      const workflowContent = await readFile(join(tmpDir, ".trellis", "workflow.md"), "utf-8");
      expect(workflowContent).toContain("standard");

      const promptsContent = await readFile(join(tmpDir, "prompts", "system.md"), "utf-8");
      expect(promptsContent).toContain("system-prompt");
    });
  });

  describe("build() with claude-code backend", () => {
    it("creates correct files for claude-code backend", async () => {
      const builder = new WorkspaceBuilder();
      const domainContext: DomainContextConfig = {
        skills: ["review"],
        mcpServers: [{ name: "m1", command: "cmd", args: [] }],
      };

      const result = await builder.build(tmpDir, domainContext, "claude-code");

      expect(result.backendType).toBe("claude-code");

      const claudeStat = await stat(join(tmpDir, ".claude"));
      expect(claudeStat.isDirectory()).toBe(true);

      const mcpRaw = await readFile(join(tmpDir, ".claude", "mcp.json"), "utf-8");
      const mcp = JSON.parse(mcpRaw);
      expect(mcp.mcpServers.m1.command).toBe("cmd");

      const settingsRaw = await readFile(join(tmpDir, ".claude", "settings.local.json"), "utf-8");
      const settings = JSON.parse(settingsRaw);
      // Permissive default (no template.permissions) uses allow: ["*"]
      expect(settings.permissions.allow).toContain("*");
    });

    it("writes permission preset to settings when permissions provided", async () => {
      const builder = new WorkspaceBuilder();
      const domainContext: DomainContextConfig = {
        skills: ["review"],
        mcpServers: [{ name: "m1", command: "cmd", args: [] }],
      };

      const result = await builder.build(tmpDir, domainContext, "claude-code", "standard");

      expect(result.backendType).toBe("claude-code");

      const settingsRaw = await readFile(join(tmpDir, ".claude", "settings.local.json"), "utf-8");
      const settings = JSON.parse(settingsRaw);
      expect(settings.permissions.allow).toContain("Read");
      expect(settings.permissions.allow).toContain("mcp__m1");
      expect(settings.permissions.ask).toContain("Bash");
    });
  });

  describe("build() with custom/unknown backend", () => {
    it("falls back to cursor when no builder registered", async () => {
      const builder = new WorkspaceBuilder();
      const domainContext: DomainContextConfig = {
        skills: ["test"],
      };

      const result = await builder.build(tmpDir, domainContext, "custom");

      // Should use cursor fallback
      expect(result.backendType).toBe("cursor");
      expect(result.verify.valid).toBe(true);

      const cursorStat = await stat(join(tmpDir, ".cursor"));
      expect(cursorStat.isDirectory()).toBe(true);
    });

    it("uses registered custom builder when registered", async () => {
      const builder = new WorkspaceBuilder();
      const customBuilder = new CustomBuilder();
      builder.registerBuilder(customBuilder);

      const domainContext: DomainContextConfig = { skills: ["test"] };
      const result = await builder.build(tmpDir, domainContext, "custom");

      expect(result.backendType).toBe("custom");
      expect(result.verify.valid).toBe(true);
    });
  });

  describe("registerBuilder()", () => {
    it("allows custom builder registration", async () => {
      const builder = new WorkspaceBuilder();
      const customBuilder = new CustomBuilder();
      builder.registerBuilder(customBuilder);

      const result = await builder.build(tmpDir, { skills: ["x"] }, "custom");
      expect(result.backendType).toBe("custom");
    });
  });

  describe("build() with no managers", () => {
    it("works with empty domain context", async () => {
      const builder = new WorkspaceBuilder();
      const result = await builder.build(tmpDir, {}, "cursor");

      expect(result.backendType).toBe("cursor");
      expect(result.verify.valid).toBe(true);

      const cursorStat = await stat(join(tmpDir, ".cursor"));
      expect(cursorStat.isDirectory()).toBe(true);
    });

    it("uses placeholders when domain context has names but no managers", async () => {
      const builder = new WorkspaceBuilder();
      const domainContext: DomainContextConfig = {
        skills: ["skill-a"],
        prompts: ["prompt-a"],
        workflow: "wf-standard",
      };

      const result = await builder.build(tmpDir, domainContext, "cursor");

      expect(result.verify.valid).toBe(true);

      const agentsContent = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
      expect(agentsContent).toContain("skill-a");
      expect(agentsContent).toContain("- skill-a");

      const promptsContent = await readFile(join(tmpDir, "prompts", "system.md"), "utf-8");
      expect(promptsContent).toContain("prompt-a");

      const workflowContent = await readFile(join(tmpDir, ".trellis", "workflow.md"), "utf-8");
      expect(workflowContent).toContain("wf-standard");
    });
  });

  describe("build() resolves domain context", () => {
    it("resolves skills via SkillManager when provided", async () => {
      const skillManager = new SkillManager();
      skillManager.register({
        name: "resolved-skill",
        content: "Resolved content from manager",
        description: "A skill",
      });
      const domainContext: DomainContextConfig = {
        skills: ["resolved-skill"],
      };

      const wsBuilder = new WorkspaceBuilder({ skills: skillManager });
      const result = await wsBuilder.build(tmpDir, domainContext, "cursor");

      expect(result.verify.valid).toBe(true);

      const agentsContent = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
      expect(agentsContent).toContain("Resolved content from manager");
      expect(agentsContent).toContain("resolved-skill");
    });

    it("resolves prompts via PromptManager when provided", async () => {
      const promptManager = new PromptManager();
      promptManager.register({
        name: "resolved-prompt",
        content: "Resolved prompt content",
      });

      const builder = new WorkspaceBuilder({ prompts: promptManager });
      await builder.build(
        tmpDir,
        { prompts: ["resolved-prompt"] },
        "cursor",
      );

      const promptsContent = await readFile(join(tmpDir, "prompts", "system.md"), "utf-8");
      expect(promptsContent).toContain("Resolved prompt content");
    });

    it("resolves workflow via WorkflowManager when provided", async () => {
      const workflowManager = new WorkflowManager();
      workflowManager.register({
        name: "trellis",
        content: "# Trellis Workflow\n\nCustom workflow content.",
      });

      const builder = new WorkspaceBuilder({ workflows: workflowManager });
      await builder.build(
        tmpDir,
        { workflow: "trellis" },
        "cursor",
      );

      const workflowContent = await readFile(join(tmpDir, ".trellis", "workflow.md"), "utf-8");
      expect(workflowContent).toContain("Custom workflow content.");
    });

    it("resolves plugins via PluginManager when provided", async () => {
      const pluginManager = new PluginManager();
      pluginManager.register({
        name: "ts",
        type: "npm",
        source: "typescript",
        enabled: true,
      });

      const builder = new WorkspaceBuilder({ plugins: pluginManager });
      await builder.build(
        tmpDir,
        { plugins: ["ts"] },
        "cursor",
      );

      const extensionsRaw = await readFile(join(tmpDir, ".cursor", "extensions.json"), "utf-8");
      const extensions = JSON.parse(extensionsRaw);
      expect(extensions.recommendations).toContain("typescript");
    });
  });
});
