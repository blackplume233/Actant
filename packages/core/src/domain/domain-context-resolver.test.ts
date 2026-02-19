import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentTemplate } from "@agentcraft/shared";
import { ComponentReferenceError } from "@agentcraft/shared";
import { TemplateRegistry } from "../template/registry/template-registry";
import { AgentInitializer } from "../initializer/agent-initializer";
import { SkillManager } from "./skill/skill-manager";
import { PromptManager } from "./prompt/prompt-manager";
import { WorkflowManager } from "./workflow/workflow-manager";

function makeTemplate(overrides?: Partial<AgentTemplate>): AgentTemplate {
  return {
    name: "integration-tpl",
    version: "1.0.0",
    backend: { type: "cursor" },
    provider: { type: "anthropic" },
    domainContext: {
      skills: ["code-review", "ts-expert"],
      prompts: ["system-reviewer"],
      mcpServers: [{ name: "fs", command: "npx", args: ["-y", "mcp-fs"] }],
      workflow: "standard",
    },
    ...overrides,
  };
}

describe("Domain Context Resolution Integration", () => {
  let tmpDir: string;
  let registry: TemplateRegistry;
  let skillMgr: SkillManager;
  let promptMgr: PromptManager;
  let workflowMgr: WorkflowManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "agentcraft-integration-"));
    registry = new TemplateRegistry();
    registry.register(makeTemplate());

    skillMgr = new SkillManager();
    skillMgr.register({ name: "code-review", content: "Check error handling\nReview types" });
    skillMgr.register({ name: "ts-expert", description: "TypeScript expert", content: "Use strict mode\nPrefer unknown over any" });

    promptMgr = new PromptManager();
    promptMgr.register({ name: "system-reviewer", content: "You are a code reviewer for {{project}}.", variables: ["project"] });

    workflowMgr = new WorkflowManager();
    workflowMgr.register({ name: "standard", content: "# Standard Workflow\n1. Plan\n2. Code\n3. Test" });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should materialize resolved skills into AGENTS.md with full content", async () => {
    const initializer = new AgentInitializer(registry, tmpDir, {
      domainManagers: { skills: skillMgr, prompts: promptMgr, workflows: workflowMgr },
    });
    await initializer.createInstance("test-agent", "integration-tpl");

    const agents = await readFile(join(tmpDir, "test-agent", "AGENTS.md"), "utf-8");
    expect(agents).toContain("## code-review");
    expect(agents).toContain("Check error handling");
    expect(agents).toContain("## ts-expert");
    expect(agents).toContain("Use strict mode");
  });

  it("should materialize resolved prompts into prompts/system.md", async () => {
    const initializer = new AgentInitializer(registry, tmpDir, {
      domainManagers: { skills: skillMgr, prompts: promptMgr, workflows: workflowMgr },
    });
    await initializer.createInstance("test-agent", "integration-tpl");

    const prompts = await readFile(join(tmpDir, "test-agent", "prompts", "system.md"), "utf-8");
    expect(prompts).toContain("## system-reviewer");
    expect(prompts).toContain("You are a code reviewer");
  });

  it("should materialize resolved workflow into .trellis/workflow.md", async () => {
    const initializer = new AgentInitializer(registry, tmpDir, {
      domainManagers: { skills: skillMgr, prompts: promptMgr, workflows: workflowMgr },
    });
    await initializer.createInstance("test-agent", "integration-tpl");

    const wf = await readFile(join(tmpDir, "test-agent", ".trellis", "workflow.md"), "utf-8");
    expect(wf).toContain("# Standard Workflow");
    expect(wf).toContain("1. Plan");
  });

  it("should materialize inline MCP configs (not name-resolved)", async () => {
    const initializer = new AgentInitializer(registry, tmpDir, {
      domainManagers: { skills: skillMgr, prompts: promptMgr, workflows: workflowMgr },
    });
    await initializer.createInstance("test-agent", "integration-tpl");

    const mcp = JSON.parse(await readFile(join(tmpDir, "test-agent", ".cursor", "mcp.json"), "utf-8"));
    expect(mcp.mcpServers.fs.command).toBe("npx");
  });

  it("should throw ComponentReferenceError when skill is not registered", async () => {
    const emptySkillMgr = new SkillManager();
    const initializer = new AgentInitializer(registry, tmpDir, {
      domainManagers: { skills: emptySkillMgr, prompts: promptMgr, workflows: workflowMgr },
    });

    await expect(
      initializer.createInstance("test-agent", "integration-tpl"),
    ).rejects.toThrow(ComponentReferenceError);
  });

  it("should throw ComponentReferenceError when prompt is not registered", async () => {
    const emptyPromptMgr = new PromptManager();
    const initializer = new AgentInitializer(registry, tmpDir, {
      domainManagers: { skills: skillMgr, prompts: emptyPromptMgr, workflows: workflowMgr },
    });

    await expect(
      initializer.createInstance("test-agent", "integration-tpl"),
    ).rejects.toThrow(ComponentReferenceError);
  });

  it("should throw ComponentReferenceError when workflow is not registered", async () => {
    const emptyWfMgr = new WorkflowManager();
    const initializer = new AgentInitializer(registry, tmpDir, {
      domainManagers: { skills: skillMgr, prompts: promptMgr, workflows: emptyWfMgr },
    });

    await expect(
      initializer.createInstance("test-agent", "integration-tpl"),
    ).rejects.toThrow(ComponentReferenceError);
  });

  it("should fall back to placeholder content when no managers provided", async () => {
    const initializer = new AgentInitializer(registry, tmpDir);
    await initializer.createInstance("fallback-agent", "integration-tpl");

    const agents = await readFile(join(tmpDir, "fallback-agent", "AGENTS.md"), "utf-8");
    expect(agents).toContain("- code-review");
    expect(agents).not.toContain("Check error handling");
  });

  it("should work with partial managers (only skills resolved)", async () => {
    const initializer = new AgentInitializer(registry, tmpDir, {
      domainManagers: { skills: skillMgr },
    });
    await initializer.createInstance("partial-agent", "integration-tpl");

    const agents = await readFile(join(tmpDir, "partial-agent", "AGENTS.md"), "utf-8");
    expect(agents).toContain("Check error handling");

    const prompts = await readFile(join(tmpDir, "partial-agent", "prompts", "system.md"), "utf-8");
    expect(prompts).toContain("- system-reviewer");
  });
});
