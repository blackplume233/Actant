import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RpcCallError, type RpcClient } from "../../client/rpc-client";
import { CliPrinter } from "../../output/printer";
import { createAgentCreateCommand } from "../agent/create";
import { createAgentStartCommand } from "../agent/start";
import { createAgentStopCommand } from "../agent/stop";
import { createAgentDestroyCommand } from "../agent/destroy";
import { createAgentListCommand } from "../agent/list";
import { createTemplateListCommand } from "../template/list";
import { createTemplateLoadCommand } from "../template/load";
import { createDaemonStopCommand } from "../daemon/stop";
import { createHubCommand } from "../hub/index";
import { createInitCommand } from "../init/index";
import { createNamespaceCommand } from "../namespace/index";
import { createVfsCommand } from "../vfs/index";

function createMockClient(): {
  call: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
} {
  return { call: vi.fn(), ping: vi.fn() };
}

function createTestPrinter(): {
  printer: CliPrinter;
  output: { logs: string[]; errors: string[] };
} {
  const output = { logs: [] as string[], errors: [] as string[] };
  const printer = new CliPrinter({
    log: (msg: string) => output.logs.push(msg),
    error: (msg: string) => output.errors.push(msg),
  });
  return { printer, output };
}

const minimalAgentMeta = {
  id: "agent-1",
  name: "my-agent",
  templateName: "minimal",
  templateVersion: "1.0.0",
  backendType: "cursor" as const,
  status: "running" as const,
  launchMode: "direct" as const,
  workspacePolicy: "persistent" as const,
  processOwnership: "managed" as const,
  createdAt: "2025-01-15T10:00:00.000Z",
  updatedAt: "2025-01-15T10:05:00.000Z",
};

const minimalTemplate = {
  name: "my-template",
  version: "1.0.0",
  backend: { type: "cursor" as const },
  provider: { type: "anthropic" as const },
  project: {},
};

describe("createAgentCreateCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("success: calls agent.create and prints success + detail", async () => {
    const mock = createMockClient();
    const client = mock as unknown as RpcClient;
    mock.call.mockResolvedValue(minimalAgentMeta);
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createAgentCreateCommand(client, printer));
    await parent.parseAsync(["node", "test", "create", "my-agent", "-t", "my-template"]);

    expect(mock.call).toHaveBeenCalledWith("agent.create", {
      name: "my-agent",
      template: "my-template",
      overrides: undefined,
    });
    expect(output.logs.some((l) => l.includes("Agent created successfully"))).toBe(true);
    expect(output.logs.some((l) => l.includes("my-agent"))).toBe(true);
  });

  it("invalid launch mode: prints error and sets exitCode 1", async () => {
    const mock = createMockClient();
    const client = mock as unknown as RpcClient;
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createAgentCreateCommand(client, printer));
    await parent.parseAsync([
      "node",
      "test",
      "create",
      "my-agent",
      "-t",
      "my-template",
      "--launch-mode",
      "invalid",
    ]);

    expect(mock.call).not.toHaveBeenCalled();
    expect(output.errors.some((e) => e.includes("Invalid launch mode"))).toBe(true);
    expect(process.exitCode).toBe(1);
  });
});

describe("createAgentStartCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("success: calls agent.start and prints Started name", async () => {
    const mock = createMockClient();
    const client = mock as unknown as RpcClient;
    mock.call.mockResolvedValue(undefined);
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createAgentStartCommand(client, printer));
    await parent.parseAsync(["node", "test", "start", "my-agent"]);

    expect(mock.call).toHaveBeenCalledWith("agent.start", { name: "my-agent" });
    expect(output.logs.some((l) => l.includes("Started") && l.includes("my-agent"))).toBe(true);
  });
});

describe("createAgentStopCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("success: calls agent.stop and prints Stopped name", async () => {
    const mock = createMockClient();
    const client = mock as unknown as RpcClient;
    mock.call.mockResolvedValue(undefined);
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createAgentStopCommand(client, printer));
    await parent.parseAsync(["node", "test", "stop", "my-agent"]);

    expect(mock.call).toHaveBeenCalledWith("agent.stop", { name: "my-agent" });
    expect(output.logs.some((l) => l.includes("Stopped") && l.includes("my-agent"))).toBe(true);
  });
});

describe("createAgentDestroyCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("without --force: warns and sets exitCode 1", async () => {
    const mock = createMockClient();
    const client = mock as unknown as RpcClient;
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createAgentDestroyCommand(client, printer));
    await parent.parseAsync(["node", "test", "destroy", "my-agent"]);

    expect(mock.call).not.toHaveBeenCalled();
    expect(output.logs.some((l) => l.includes("Destroying agent") && l.includes("my-agent"))).toBe(
      true,
    );
    expect(output.logs.some((l) => l.includes("--force"))).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it("with --force: calls agent.destroy and prints Destroyed name", async () => {
    const mock = createMockClient();
    const client = mock as unknown as RpcClient;
    mock.call.mockResolvedValue(undefined);
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createAgentDestroyCommand(client, printer));
    await parent.parseAsync(["node", "test", "destroy", "my-agent", "--force"]);

    expect(mock.call).toHaveBeenCalledWith("agent.destroy", { name: "my-agent" });
    expect(output.logs.some((l) => l.includes("Destroyed") && l.includes("my-agent"))).toBe(true);
  });

  it("with --force + agent not found: idempotent success (exit 0)", async () => {
    const mock = createMockClient();
    const client = mock as unknown as RpcClient;
    mock.call.mockRejectedValue(new RpcCallError("Agent instance \"ghost\" not found", -32003));
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createAgentDestroyCommand(client, printer));
    await parent.parseAsync(["node", "test", "destroy", "ghost", "--force"]);

    expect(mock.call).toHaveBeenCalledWith("agent.destroy", { name: "ghost" });
    expect(output.logs.some((l) => l.includes("already absent"))).toBe(true);
    expect(process.exitCode).not.toBe(1);
  });
});

describe("createAgentListCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("returns agents list and printer.log called with formatted output", async () => {
    const mock = createMockClient();
    const client = mock as unknown as RpcClient;
    mock.call.mockResolvedValue([minimalAgentMeta]);
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createAgentListCommand(client, printer));
    await parent.parseAsync(["node", "test", "list"]);

    expect(mock.call).toHaveBeenCalledWith("agent.list", {});
    expect(output.logs.length).toBeGreaterThan(0);
    expect(output.logs.some((l) => l.includes("my-agent"))).toBe(true);
  });
});

describe("createTemplateListCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("returns templates and printer.log called with formatted output", async () => {
    const mock = createMockClient();
    const client = mock as unknown as RpcClient;
    mock.call.mockResolvedValue([minimalTemplate]);
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createTemplateListCommand(client, printer));
    await parent.parseAsync(["node", "test", "list"]);

    expect(mock.call).toHaveBeenCalledWith("template.list", {});
    expect(output.logs.length).toBeGreaterThan(0);
    expect(output.logs.some((l) => l.includes("my-template"))).toBe(true);
  });
});

describe("createTemplateLoadCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("success: returns template and prints Loaded", async () => {
    const mock = createMockClient();
    const client = mock as unknown as RpcClient;
    mock.call.mockResolvedValue(minimalTemplate);
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createTemplateLoadCommand(client, printer));
    await parent.parseAsync(["node", "test", "load", "/tmp/template.json"]);

    expect(mock.call).toHaveBeenCalledWith("template.load", {
      filePath: expect.stringContaining("template.json"),
    });
    expect(output.logs.some((l) => l.includes("Loaded") && l.includes("my-template"))).toBe(true);
  });
});

describe("createDaemonStopCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("creates a command that can be invoked", () => {
    const cmd = createDaemonStopCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe("stop");
  });

  it("connection fails: prints Daemon is not running", async () => {
    const mock = createMockClient();
    mock.call.mockRejectedValue(new Error("Connection refused"));
    const client = mock as unknown as RpcClient;
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createDaemonStopCommand(printer, client));
    await parent.parseAsync(["node", "test", "stop"]);

    expect(output.logs.some((l) => l.includes("Daemon is not running"))).toBe(true);
  });
});

describe("createHubCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("hub status reuses running daemon and prints project status", async () => {
    const mock = createMockClient();
    mock.ping.mockResolvedValue(true);
    mock.call
      .mockResolvedValueOnce({
        projectRoot: "/repo",
        projectName: "repo",
        configPath: null,
        configsDir: "/repo/configs",
        catalogWarnings: [],
        components: { skills: 1, prompts: 0, mcpServers: 0, workflows: 0, templates: 0 },
        mounts: {
          project: "/hub/project",
          workspace: "/hub/workspace",
          config: "/hub/config",
          skills: "/hub/skills",
          prompts: "/hub/prompts",
          mcp: "/hub/mcp",
          workflows: "/hub/workflows",
          templates: "/hub/templates",
        },
      })
      .mockResolvedValueOnce({
        active: true,
        hostProfile: "context",
        runtimeState: "inactive",
        projectRoot: "/repo",
        projectName: "repo",
        configPath: null,
        configsDir: "/repo/configs",
        catalogWarnings: [],
        components: { skills: 1, prompts: 0, mcpServers: 0, workflows: 0, templates: 0 },
        mounts: {
          project: "/hub/project",
          workspace: "/hub/workspace",
          config: "/hub/config",
          skills: "/hub/skills",
          prompts: "/hub/prompts",
          mcp: "/hub/mcp",
          workflows: "/hub/workflows",
          templates: "/hub/templates",
        },
      });

    const client = mock as unknown as RpcClient;
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createHubCommand(client, printer));

    await parent.parseAsync(["node", "test", "hub", "status"]);

    expect(mock.call).toHaveBeenNthCalledWith(1, "hub.activate", { projectDir: process.cwd() });
    expect(mock.call).toHaveBeenNthCalledWith(2, "hub.status", {});
    expect(output.logs.some((line) => line.includes("Host Profile: context"))).toBe(true);
    expect(output.logs.some((line) => line.includes("Project:      repo"))).toBe(true);
  });

  it("hub status falls back to standalone project context when daemon bind is not permitted", async () => {
    const mock = createMockClient();
    mock.ping.mockResolvedValue(false);

    const client = mock as unknown as RpcClient;
    const { printer, output } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createHubCommand(client, printer, {
      ensureDaemonRunningImpl: vi.fn().mockRejectedValue(new Error("listen EPERM: operation not permitted /tmp/actant.sock")),
      createStandaloneBackend: vi.fn().mockResolvedValue({
        mode: "standalone",
        status: {
          active: true,
          hostProfile: "context",
          runtimeState: "inactive",
          projectRoot: "/repo",
          projectName: "repo",
          configPath: null,
          configsDir: "/repo/configs",
          catalogWarnings: [],
          components: { skills: 1, prompts: 0, mcpServers: 0, workflows: 0, templates: 0 },
          mounts: {
            project: "/hub/project",
            workspace: "/hub/workspace",
            config: "/hub/config",
            skills: "/hub/skills",
            prompts: "/hub/prompts",
            mcp: "/hub/mcp",
            workflows: "/hub/workflows",
            templates: "/hub/templates",
          },
        },
        read: vi.fn(),
        list: vi.fn(),
        grep: vi.fn(),
      }),
    }));

    await parent.parseAsync(["node", "test", "hub", "status"]);

    expect(mock.call).not.toHaveBeenCalled();
    expect(output.logs.some((line) => line.includes("Host Profile: context"))).toBe(true);
    expect(output.logs.some((line) => line.includes("Project:      repo"))).toBe(true);
    expect(output.logs.some((line) => line.includes("standalone namespace mode"))).toBe(true);
  });

  it("hub read routes the root project manifest through the daemon hub mount", async () => {
    const mock = createMockClient();
    mock.ping.mockResolvedValue(true);
    mock.call
      .mockResolvedValueOnce({
        projectRoot: "/repo",
        projectName: "repo",
        configPath: null,
        configsDir: "/repo/configs",
        catalogWarnings: [],
        components: { skills: 1, prompts: 0, mcpServers: 0, workflows: 0, templates: 0 },
        mounts: {
          project: "/hub/project",
          workspace: "/hub/workspace",
          config: "/hub/config",
          skills: "/hub/skills",
          prompts: "/hub/prompts",
          mcp: "/hub/mcp",
          workflows: "/hub/workflows",
          templates: "/hub/templates",
        },
      })
      .mockResolvedValueOnce({
        active: true,
        hostProfile: "context",
        runtimeState: "inactive",
        projectRoot: "/repo",
        projectName: "repo",
        configPath: null,
        configsDir: "/repo/configs",
        catalogWarnings: [],
        components: { skills: 1, prompts: 0, mcpServers: 0, workflows: 0, templates: 0 },
        mounts: {
          project: "/hub/project",
          workspace: "/hub/workspace",
          config: "/hub/config",
          skills: "/hub/skills",
          prompts: "/hub/prompts",
          mcp: "/hub/mcp",
          workflows: "/hub/workflows",
          templates: "/hub/templates",
        },
      })
      .mockResolvedValueOnce({
        content: "{\"name\":\"repo\"}",
        mimeType: "application/json",
      });

    const client = mock as unknown as RpcClient;
    const { printer } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createHubCommand(client, printer));

    await parent.parseAsync(["node", "test", "hub", "read", "/_project.json"]);

    expect(mock.call).toHaveBeenNthCalledWith(3, "vfs.read", {
      path: "/hub/_project.json",
      startLine: undefined,
      endLine: undefined,
      token: undefined,
    });
  });

  it("hub list routes child project paths through the daemon hub mount", async () => {
    const mock = createMockClient();
    mock.ping.mockResolvedValue(true);
    mock.call
      .mockResolvedValueOnce({
        projectRoot: "/repo",
        projectName: "repo",
        configPath: null,
        configsDir: "/repo/configs",
        catalogWarnings: [],
        components: { skills: 1, prompts: 0, mcpServers: 0, workflows: 0, templates: 0 },
        mounts: {
          project: "/hub/project",
          workspace: "/hub/workspace",
          config: "/hub/config",
          skills: "/hub/skills",
          prompts: "/hub/prompts",
          mcp: "/hub/mcp",
          workflows: "/hub/workflows",
          templates: "/hub/templates",
        },
      })
      .mockResolvedValueOnce({
        active: true,
        hostProfile: "context",
        runtimeState: "inactive",
        projectRoot: "/repo",
        projectName: "repo",
        configPath: null,
        configsDir: "/repo/configs",
        catalogWarnings: [],
        components: { skills: 1, prompts: 0, mcpServers: 0, workflows: 0, templates: 0 },
        mounts: {
          project: "/hub/project",
          workspace: "/hub/workspace",
          config: "/hub/config",
          skills: "/hub/skills",
          prompts: "/hub/prompts",
          mcp: "/hub/mcp",
          workflows: "/hub/workflows",
          templates: "/hub/templates",
        },
      })
      .mockResolvedValueOnce([
        {
          name: "child",
          path: "/hub/projects/child",
          type: "directory",
        },
      ]);

    const client = mock as unknown as RpcClient;
    const { printer } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createHubCommand(client, printer));

    await parent.parseAsync(["node", "test", "hub", "list", "/projects/child"]);

    expect(mock.call).toHaveBeenNthCalledWith(3, "vfs.list", {
      path: "/hub/projects/child",
      recursive: undefined,
      long: undefined,
      token: undefined,
    });
  });
});

describe("createInitCommand", () => {
  let savedCwd: string;

  beforeEach(() => {
    savedCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(savedCwd);
  });

  it("writes a minimal namespace scaffold locally", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "actant-init-test-"));
    process.chdir(projectDir);

    try {
      const { printer } = createTestPrinter();
      const parent = new Command();
      parent.exitOverride();
      parent.addCommand(createInitCommand(printer));

      await parent.parseAsync(["node", "test", "init", "--scaffold", "minimal"]);

      const raw = await readFile(join(projectDir, "actant.namespace.json"), "utf-8");
      const parsed = JSON.parse(raw) as { mounts: Array<{ path: string; type: string; options?: { hostPath?: string } }> };
      expect(parsed.mounts).toEqual([
        { type: "hostfs", path: "/workspace", options: { hostPath: "." } },
        { type: "hostfs", path: "/config", options: { hostPath: "configs" } },
      ]);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });
});

describe("createNamespaceCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("marks invalid validation results as exit code 1", async () => {
    const mock = createMockClient();
    mock.call.mockResolvedValue({
      valid: false,
      schemaValid: true,
      projectRoot: "/repo",
      configPath: "/repo/actant.namespace.json",
      mountDeclarationIssues: [{ path: "mounts[0].path", message: "duplicate" }],
      derivedViewPreconditions: [],
      warnings: [],
    });

    const client = mock as unknown as RpcClient;
    const { printer } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createNamespaceCommand(client, printer));

    await parent.parseAsync(["node", "test", "namespace", "validate"]);

    expect(mock.call).toHaveBeenCalledWith("namespace.validate", {});
    expect(process.exitCode).toBe(1);
  });
});

describe("createVfsCommand", () => {
  let savedExitCode: number | undefined;

  beforeEach(() => {
    const raw = process.exitCode;
    savedExitCode = typeof raw === "number" ? raw : undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  it("routes mount add to namespace authoring params", async () => {
    const mock = createMockClient();
    mock.call.mockResolvedValue({
      mount: {
        path: "/extra",
        filesystemType: "hostfs",
        mounted: true,
      },
    });

    const client = mock as unknown as RpcClient;
    const { printer } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createVfsCommand(client, printer));

    await parent.parseAsync([
      "node",
      "test",
      "vfs",
      "mount",
      "add",
      "--type",
      "hostfs",
      "--path",
      "/extra",
      "--host-path",
      "./extra",
    ]);

    expect(mock.call).toHaveBeenCalledWith("vfs.mountAdd", {
      name: undefined,
      path: "/extra",
      type: "hostfs",
      options: { hostPath: "./extra" },
    });
  });

  it("routes mount remove by path", async () => {
    const mock = createMockClient();
    mock.call.mockResolvedValue({ ok: true, path: "/scratch" });

    const client = mock as unknown as RpcClient;
    const { printer } = createTestPrinter();
    const parent = new Command();
    parent.exitOverride();
    parent.addCommand(createVfsCommand(client, printer));

    await parent.parseAsync(["node", "test", "vfs", "mount", "remove", "/scratch"]);

    expect(mock.call).toHaveBeenCalledWith("vfs.mountRemove", { path: "/scratch" });
  });
});
