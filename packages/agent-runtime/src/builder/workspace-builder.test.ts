import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ProjectContextConfig } from "@actant/shared";
import {
  SkillManager,
  PromptManager,
  WorkflowManager,
  PluginManager,
} from "@actant/domain-context";
import { createBackendManager } from "../manager/launcher/backend-registry";
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
      const project: ProjectContextConfig = {
        skills: ["skill-a", "skill-b"],
        prompts: ["system-prompt"],
        mcpServers: [{ name: "fs", command: "npx", args: ["-y", "mcp-fs"] }],
        workflow: "standard",
      };

      const result = await builder.build(tmpDir, project, "cursor");

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
      const project: ProjectContextConfig = {
        skills: ["review"],
        mcpServers: [{ name: "m1", command: "cmd", args: [] }],
      };

      const result = await builder.build(tmpDir, project, "claude-code");

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
      const project: ProjectContextConfig = {
        skills: ["review"],
        mcpServers: [{ name: "m1", command: "cmd", args: [] }],
      };

      const result = await builder.build(tmpDir, project, "claude-code", "standard");

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
      const project: ProjectContextConfig = {
        skills: ["test"],
      };

      const result = await builder.build(tmpDir, project, "custom");

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

      const project: ProjectContextConfig = { skills: ["test"] };
      const result = await builder.build(tmpDir, project, "custom");

      expect(result.backendType).toBe("custom");
      expect(result.verify.valid).toBe(true);
    });

    it("uses an injected BackendManager instead of the singleton fallback", async () => {
      const backendManager = createBackendManager();
      backendManager.register({
        name: "isolated",
        version: "1.0.0",
        description: "test-only isolated backend",
        origin: { type: "builtin" },
        supportedModes: ["resolve"],
        defaultInteractionModes: ["open"],
        runtimeProfile: "openOnly",
        maturity: "stable",
        capabilities: {
          supportsOpen: true,
          supportsManagedSessions: false,
          supportsServiceArchetype: false,
          supportsEmployeeArchetype: false,
          supportsPromptApi: false,
        },
        materialization: {
          configDir: ".isolated",
          scaffoldDirs: [".isolated"],
          components: {},
          verifyChecks: [{ path: ".isolated", type: "dir", severity: "warning" }],
        },
      });

      const builder = new WorkspaceBuilder(undefined, { backendManager });
      const result = await builder.build(tmpDir, {}, "isolated" as never);

      expect(result.backendType).toBe("isolated");
      expect(result.verify.valid).toBe(true);
      const isolatedStat = await stat(join(tmpDir, ".isolated"));
      expect(isolatedStat.isDirectory()).toBe(true);
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
    it("works with an empty project context", async () => {
      const builder = new WorkspaceBuilder();
      const result = await builder.build(tmpDir, {}, "cursor");

      expect(result.backendType).toBe("cursor");
      expect(result.verify.valid).toBe(true);

      const cursorStat = await stat(join(tmpDir, ".cursor"));
      expect(cursorStat.isDirectory()).toBe(true);
    });

    it("uses placeholders when project context has names but no managers", async () => {
      const builder = new WorkspaceBuilder();
      const project: ProjectContextConfig = {
        skills: ["skill-a"],
        prompts: ["prompt-a"],
        workflow: "wf-standard",
      };

      const result = await builder.build(tmpDir, project, "cursor");

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

  describe("build() resolves project context", () => {
    it("resolves skills via SkillManager when provided", async () => {
      const skillManager = new SkillManager();
      skillManager.set({
        name: "resolved-skill",
        content: "Resolved content from manager",
        description: "A skill",
      });
      const project: ProjectContextConfig = {
        skills: ["resolved-skill"],
      };

      const wsBuilder = new WorkspaceBuilder({ skills: skillManager });
      const result = await wsBuilder.build(tmpDir, project, "cursor");

      expect(result.verify.valid).toBe(true);

      const agentsContent = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
      expect(agentsContent).toContain("Resolved content from manager");
      expect(agentsContent).toContain("resolved-skill");
    });

    it("resolves prompts via PromptManager when provided", async () => {
      const promptManager = new PromptManager();
      promptManager.set({
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
      workflowManager.set({
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
      pluginManager.set({
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
