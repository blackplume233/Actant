import { describe, it, expect } from "vitest";
import {
  formatTemplateList,
  formatTemplateDetail,
  formatAgentList,
  formatAgentDetail,
} from "../formatter";
import type { AgentTemplate, AgentInstanceMeta } from "@actant/shared";

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

const minimalTemplate: AgentTemplate = {
  name: "minimal",
  version: "1.0.0",
  backend: { type: "cursor" },
  provider: { type: "anthropic" },
  domainContext: {},
};

const fullTemplate: AgentTemplate = {
  name: "full-tpl",
  version: "2.0.0",
  description: "A full template",
  backend: { type: "cursor", config: { executablePath: "/bin/cursor" } },
  provider: { type: "anthropic", config: { model: "claude-3" } },
  domainContext: {
    skills: ["skill-a", "skill-b"],
    prompts: ["prompt-1"],
    mcpServers: [
      { name: "mcp-1", command: "npx", args: ["mcp-server"], env: { FOO: "bar" } },
    ],
    workflow: "trellis",
    subAgents: ["sub-1"],
  },
  metadata: { author: "test", license: "MIT" },
};

const minimalAgent: AgentInstanceMeta = {
  id: "agent-1",
  name: "my-agent",
  templateName: "minimal",
  templateVersion: "1.0.0",
  backendType: "cursor",
  interactionModes: ["start"],
  status: "running",
  launchMode: "direct",
  workspacePolicy: "persistent",
  processOwnership: "managed",
  archetype: "tool",
  autoStart: false,
  createdAt: "2025-01-15T10:00:00.000Z",
  updatedAt: "2025-01-15T10:05:00.000Z",
};

const fullAgent: AgentInstanceMeta = {
  ...minimalAgent,
  id: "agent-2",
  name: "full-agent",
  templateName: "full-tpl",
  templateVersion: "2.0.0",
  pid: 12345,
  metadata: { env: "prod", region: "us-east" },
};

describe("formatTemplateList", () => {
  it("json format", () => {
    const out = formatTemplateList([minimalTemplate, fullTemplate], "json");
    const parsed = JSON.parse(out) as AgentTemplate[];
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.name).toBe("minimal");
    expect(parsed[1]!.name).toBe("full-tpl");
  });

  it("quiet format", () => {
    const out = formatTemplateList([minimalTemplate, fullTemplate], "quiet");
    expect(out).toBe("minimal\nfull-tpl");
  });

  it("table format empty", () => {
    const out = formatTemplateList([], "table");
    expect(stripAnsi(out)).toContain("No templates registered");
  });

  it("table format non-empty", () => {
    const out = formatTemplateList([minimalTemplate, fullTemplate], "table");
    const plain = stripAnsi(out);
    expect(plain).toContain("Name");
    expect(plain).toContain("Version");
    expect(plain).toContain("Backend");
    expect(plain).toContain("Provider");
    expect(plain).toContain("Description");
    expect(plain).toContain("minimal");
    expect(plain).toContain("1.0.0");
    expect(plain).toContain("cursor");
    expect(plain).toContain("full-tpl");
    expect(plain).toContain("A full template");
  });
});

describe("formatTemplateDetail", () => {
  it("json format", () => {
    const out = formatTemplateDetail(fullTemplate, "json");
    const parsed = JSON.parse(out) as AgentTemplate;
    expect(parsed.name).toBe("full-tpl");
    expect(parsed.version).toBe("2.0.0");
    expect(parsed.domainContext.skills).toEqual(["skill-a", "skill-b"]);
  });

  it("quiet format", () => {
    const out = formatTemplateDetail(fullTemplate, "quiet");
    expect(out).toBe("full-tpl");
  });

  it("table format", () => {
    const out = formatTemplateDetail(fullTemplate, "table");
    const plain = stripAnsi(out);
    expect(plain).toContain("Template:");
    expect(plain).toContain("full-tpl");
    expect(plain).toContain("Version:");
    expect(plain).toContain("2.0.0");
    expect(plain).toContain("Backend:");
    expect(plain).toContain("cursor");
    expect(plain).toContain("Provider:");
    expect(plain).toContain("anthropic");
    expect(plain).toContain("Domain Context:");
    expect(plain).toContain("skill-a");
    expect(plain).toContain("skill-b");
    expect(plain).toContain("prompt-1");
    expect(plain).toContain("mcp-1");
    expect(plain).toContain("trellis");
    expect(plain).toContain("sub-1");
    expect(plain).toContain("Metadata:");
    expect(plain).toContain("author");
    expect(plain).toContain("test");
    expect(plain).toContain("license");
    expect(plain).toContain("MIT");
  });
});

describe("formatAgentList", () => {
  it("json format", () => {
    const out = formatAgentList([minimalAgent, fullAgent], "json");
    const parsed = JSON.parse(out) as AgentInstanceMeta[];
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.name).toBe("my-agent");
    expect(parsed[1]!.name).toBe("full-agent");
  });

  it("quiet format", () => {
    const out = formatAgentList([minimalAgent, fullAgent], "quiet");
    expect(out).toBe("my-agent\nfull-agent");
  });

  it("table format empty", () => {
    const out = formatAgentList([], "table");
    expect(stripAnsi(out)).toContain("No agents found");
  });

  it("table format non-empty", () => {
    const out = formatAgentList([minimalAgent, fullAgent], "table");
    const plain = stripAnsi(out);
    expect(plain).toContain("Name");
    expect(plain).toContain("Template");
    expect(plain).toContain("Status");
    expect(plain).toContain("Launch Mode");
    expect(plain).toContain("PID");
    expect(plain).toContain("Created");
    expect(plain).toContain("my-agent");
    expect(plain).toContain("minimal@1.0.0");
    expect(plain).toContain("running");
    expect(plain).toContain("full-agent");
    expect(plain).toContain("12345");
  });
});

describe("formatAgentDetail", () => {
  it("json format", () => {
    const out = formatAgentDetail(fullAgent, "json");
    const parsed = JSON.parse(out) as AgentInstanceMeta;
    expect(parsed.name).toBe("full-agent");
    expect(parsed.pid).toBe(12345);
    expect(parsed.metadata).toEqual({ env: "prod", region: "us-east" });
  });

  it("quiet format", () => {
    const out = formatAgentDetail(fullAgent, "quiet");
    expect(out).toBe("full-agent");
  });

  it("table format without metadata", () => {
    const out = formatAgentDetail(minimalAgent, "table");
    const plain = stripAnsi(out);
    expect(plain).toContain("Agent:");
    expect(plain).toContain("my-agent");
    expect(plain).toContain("ID:");
    expect(plain).toContain("agent-1");
    expect(plain).toContain("Template:");
    expect(plain).toContain("minimal@1.0.0");
    expect(plain).toContain("Status:");
    expect(plain).toContain("running");
    expect(plain).toContain("Launch:");
    expect(plain).toContain("direct");
    expect(plain).toContain("PID:");
    expect(plain).toContain("Created:");
    expect(plain).toContain("2025-01-15T10:00:00.000Z");
    expect(plain).not.toContain("Metadata:");
  });

  it("table format with metadata", () => {
    const out = formatAgentDetail(fullAgent, "table");
    const plain = stripAnsi(out);
    expect(plain).toContain("Agent:");
    expect(plain).toContain("full-agent");
    expect(plain).toContain("Metadata:");
    expect(plain).toContain("env");
    expect(plain).toContain("prod");
    expect(plain).toContain("region");
    expect(plain).toContain("us-east");
  });
});
