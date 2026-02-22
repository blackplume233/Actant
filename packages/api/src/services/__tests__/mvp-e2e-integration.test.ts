import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppContext } from "../app-context";
import { HandlerRegistry } from "../../handlers/handler-registry";
import { registerTemplateHandlers } from "../../handlers/template-handlers";
import { registerAgentHandlers } from "../../handlers/agent-handlers";
import { registerDomainHandlers } from "../../handlers/domain-handlers";

/**
 * MVP End-to-End Integration Test
 *
 * Validates the full flow:
 *   template load → skill/prompt loaded → agent create → verify workspace →
 *   agent start → agent run → agent stop → agent destroy
 */
describe("MVP E2E Integration", () => {
  let tmpDir: string;
  let ctx: AppContext;
  let registry: HandlerRegistry;

  const skill = {
    name: "test-review",
    description: "Code review rules",
    content: "## Review Rules\n\n- Check error handling\n- Verify type safety",
    tags: ["review"],
  };

  const prompt = {
    name: "test-system-prompt",
    description: "System prompt for reviewer",
    content: "You are a code reviewer for {{project}}.\nFocus on quality and correctness.",
    variables: ["project"],
  };

  const workflow = {
    name: "test-dev-workflow",
    content: "# Dev Workflow\n\n1. Read context\n2. Plan\n3. Implement\n4. Test",
  };

  const template = {
    name: "test-review-agent",
    version: "1.0.0",
    description: "A test code review agent",
    backend: { type: "claude-code", config: { model: "claude-sonnet-4-20250514" } },
    provider: { type: "anthropic" },
    domainContext: {
      skills: ["test-review"],
      prompts: ["test-system-prompt"],
      mcpServers: [{ name: "fs", command: "npx", args: ["-y", "mcp-fs"] }],
      workflow: "test-dev-workflow",
    },
    metadata: { author: "test", tags: "review" },
  };

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ac-mvp-e2e-"));

    const configsDir = join(tmpDir, "configs");
    await mkdir(join(configsDir, "skills"), { recursive: true });
    await mkdir(join(configsDir, "prompts"), { recursive: true });
    await mkdir(join(configsDir, "mcp"), { recursive: true });
    await mkdir(join(configsDir, "workflows"), { recursive: true });
    await mkdir(join(configsDir, "templates"), { recursive: true });

    await writeFile(join(configsDir, "skills", "test-review.json"), JSON.stringify(skill));
    await writeFile(join(configsDir, "prompts", "test-system-prompt.json"), JSON.stringify(prompt));
    await writeFile(join(configsDir, "workflows", "test-dev-workflow.json"), JSON.stringify(workflow));
    await writeFile(join(configsDir, "templates", "test-review-agent.json"), JSON.stringify(template));

    ctx = new AppContext({ homeDir: tmpDir, configsDir, launcherMode: "mock" });
    await ctx.init();

    registry = new HandlerRegistry();
    registerTemplateHandlers(registry);
    registerAgentHandlers(registry);
    registerDomainHandlers(registry);
  });

  afterAll(async () => {
    ctx.agentManager.dispose();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("step 1: template auto-loaded from configs", async () => {
    const templates = await registry.get("template.list")!({}, ctx) as unknown[];
    expect(templates.length).toBeGreaterThanOrEqual(1);

    const tpl = await registry.get("template.get")!({ name: "test-review-agent" }, ctx) as { name: string };
    expect(tpl.name).toBe("test-review-agent");
  });

  it("step 2: domain components auto-loaded from configs", async () => {
    const skills = await registry.get("skill.list")!({}, ctx) as unknown[];
    expect(skills.length).toBeGreaterThanOrEqual(1);

    const prompts = await registry.get("prompt.list")!({}, ctx) as unknown[];
    expect(prompts.length).toBeGreaterThanOrEqual(1);

    const sk = await registry.get("skill.get")!({ name: "test-review" }, ctx) as { content: string };
    expect(sk.content).toContain("Review Rules");

    const pr = await registry.get("prompt.get")!({ name: "test-system-prompt" }, ctx) as { content: string };
    expect(pr.content).toContain("{{project}}");
  });

  it("step 3: agent create materializes domain context", async () => {
    const result = await registry.get("agent.create")!(
      { name: "e2e-agent", template: "test-review-agent" },
      ctx,
    ) as { name: string; status: string; backendType: string };

    expect(result.name).toBe("e2e-agent");
    expect(result.status).toBe("created");
    expect(result.backendType).toBe("claude-code");
  });

  it("step 4: workspace files contain full content (not placeholders)", async () => {
    const instanceDir = join(tmpDir, "instances", "e2e-agent");

    const agents = await readFile(join(instanceDir, "AGENTS.md"), "utf-8");
    expect(agents).toContain("## test-review");
    expect(agents).toContain("Check error handling");
    expect(agents).not.toContain("- test-review");

    const prompts = await readFile(join(instanceDir, "prompts", "system.md"), "utf-8");
    expect(prompts).toContain("## test-system-prompt");
    expect(prompts).toContain("You are a code reviewer");

    const wf = await readFile(join(instanceDir, ".trellis", "workflow.md"), "utf-8");
    expect(wf).toContain("# Dev Workflow");
    expect(wf).toContain("1. Read context");

    const mcpRaw = await readFile(join(instanceDir, ".claude", "mcp.json"), "utf-8");
    const mcpConfig = JSON.parse(mcpRaw);
    expect(mcpConfig.mcpServers.fs).toBeDefined();
    expect(mcpConfig.mcpServers.fs.command).toBe("npx");

    const metaRaw = await readFile(join(instanceDir, ".actant.json"), "utf-8");
    const meta = JSON.parse(metaRaw);
    expect(meta.backendType).toBe("claude-code");
    expect(meta.templateName).toBe("test-review-agent");
  });

  it("step 5: agent start/stop lifecycle", async () => {
    const startResult = await registry.get("agent.start")!(
      { name: "e2e-agent" },
      ctx,
    ) as { status: string };
    expect(startResult.status).toBe("running");

    const statusResult = await registry.get("agent.status")!(
      { name: "e2e-agent" },
      ctx,
    ) as { status: string; pid: number };
    expect(statusResult.status).toBe("running");
    expect(statusResult.pid).toBeDefined();

    const stopResult = await registry.get("agent.stop")!(
      { name: "e2e-agent" },
      ctx,
    ) as { status: string };
    expect(stopResult.status).toBe("stopped");
  });

  it("step 5b: agent.run handler invokes communicator with correct workspace", async () => {
    const mockRunPrompt = vi.spyOn(ctx.agentManager, "runPrompt")
      .mockResolvedValueOnce({ text: "LGTM — no issues found.", sessionId: "sess-123" });

    const result = await registry.get("agent.run")!(
      { name: "e2e-agent", prompt: "Review src/index.ts" },
      ctx,
    ) as { text: string; sessionId?: string };

    expect(result.text).toBe("LGTM — no issues found.");
    expect(result.sessionId).toBe("sess-123");
    expect(mockRunPrompt).toHaveBeenCalledWith(
      "e2e-agent",
      "Review src/index.ts",
      undefined,
    );

    mockRunPrompt.mockRestore();
  });

  it("step 6: agent destroy cleans up", async () => {
    const result = await registry.get("agent.destroy")!(
      { name: "e2e-agent" },
      ctx,
    ) as { success: boolean };
    expect(result.success).toBe(true);

    const list = await registry.get("agent.list")!({}, ctx) as unknown[];
    expect(list).toHaveLength(0);
  });
});
