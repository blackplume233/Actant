import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { CliPrinter } from "../../output/printer";
import { createAgentCreateCommand } from "../agent/create";
import { createAgentStartCommand } from "../agent/start";
import { createAgentStopCommand } from "../agent/stop";
import { createAgentDestroyCommand } from "../agent/destroy";
import { createAgentListCommand } from "../agent/list";
import { createTemplateListCommand } from "../template/list";
import { createTemplateLoadCommand } from "../template/load";
import { createDaemonStopCommand } from "../daemon/stop";

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
  domainContext: {},
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
