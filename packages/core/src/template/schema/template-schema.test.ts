import { describe, it, expect } from "vitest";
import {
  AgentTemplateSchema,
  DomainContextSchema,
  McpServerRefSchema,
} from "./template-schema";

const VALID_TEMPLATE = {
  name: "code-review-agent",
  version: "1.0.0",
  description: "A code review agent powered by Claude",
  backend: {
    type: "claude-code" as const,
    config: { model: "claude-sonnet-4-20250514" },
  },
  provider: {
    type: "anthropic" as const,
    config: { apiKeyEnv: "ANTHROPIC_API_KEY" },
  },
  domainContext: {
    skills: ["code-review", "typescript-expert"],
    prompts: ["system-code-reviewer"],
    mcpServers: [
      {
        name: "filesystem",
        command: "npx",
        args: ["-y", "@anthropic/mcp-filesystem"],
      },
    ],
    workflow: "trellis-standard",
  },
  initializer: {
    steps: [
      { type: "create-workspace" },
      { type: "install-dependencies" },
      { type: "apply-workflow" },
    ],
  },
  metadata: {
    author: "Actant Team",
    tags: "code-review,typescript",
  },
};

const MINIMAL_TEMPLATE = {
  name: "minimal",
  version: "0.1.0",
  backend: { type: "cursor" as const },
  provider: { type: "openai" as const },
  domainContext: {},
};

describe("AgentTemplateSchema", () => {
  it("validates a fully-specified template", () => {
    const result = AgentTemplateSchema.safeParse(VALID_TEMPLATE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("code-review-agent");
      expect(result.data.version).toBe("1.0.0");
      expect(result.data.domainContext.skills).toEqual(["code-review", "typescript-expert"]);
      expect(result.data.domainContext.mcpServers).toHaveLength(1);
    }
  });

  it("validates a minimal template (only required fields)", () => {
    const result = AgentTemplateSchema.safeParse(MINIMAL_TEMPLATE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("minimal");
      expect(result.data.domainContext.skills).toEqual([]);
      expect(result.data.domainContext.prompts).toEqual([]);
      expect(result.data.domainContext.mcpServers).toEqual([]);
      expect(result.data.domainContext.subAgents).toEqual([]);
      expect(result.data.description).toBeUndefined();
      expect(result.data.initializer).toBeUndefined();
      expect(result.data.metadata).toBeUndefined();
    }
  });

  it("rejects missing name", () => {
    const { name: _, ...noName } = VALID_TEMPLATE;
    const result = AgentTemplateSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = AgentTemplateSchema.safeParse({
      ...MINIMAL_TEMPLATE,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 100 characters", () => {
    const result = AgentTemplateSchema.safeParse({
      ...MINIMAL_TEMPLATE,
      name: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const { version: _, ...noVersion } = VALID_TEMPLATE;
    const result = AgentTemplateSchema.safeParse(noVersion);
    expect(result.success).toBe(false);
  });

  it("rejects invalid version format", () => {
    const cases = ["1.0", "v1.0.0", "1.0.0-beta", "abc", "1.0.0.0"];
    for (const version of cases) {
      const result = AgentTemplateSchema.safeParse({
        ...MINIMAL_TEMPLATE,
        version,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects missing backend", () => {
    const { backend: _, ...noBackend } = MINIMAL_TEMPLATE;
    const result = AgentTemplateSchema.safeParse(noBackend);
    expect(result.success).toBe(false);
  });

  it("rejects invalid backend type", () => {
    const result = AgentTemplateSchema.safeParse({
      ...MINIMAL_TEMPLATE,
      backend: { type: "unknown-backend" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing provider", () => {
    const { provider: _, ...noProvider } = MINIMAL_TEMPLATE;
    const result = AgentTemplateSchema.safeParse(noProvider);
    expect(result.success).toBe(false);
  });

  it("rejects invalid provider type", () => {
    const result = AgentTemplateSchema.safeParse({
      ...MINIMAL_TEMPLATE,
      provider: { type: "google" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing domainContext", () => {
    const { domainContext: _, ...noDC } = MINIMAL_TEMPLATE;
    const result = AgentTemplateSchema.safeParse(noDC);
    expect(result.success).toBe(false);
  });

  it("rejects initializer with empty steps array", () => {
    const result = AgentTemplateSchema.safeParse({
      ...MINIMAL_TEMPLATE,
      initializer: { steps: [] },
    });
    expect(result.success).toBe(false);
  });

  it("accepts template with metadata as string record", () => {
    const result = AgentTemplateSchema.safeParse({
      ...MINIMAL_TEMPLATE,
      metadata: { author: "test", env: "production" },
    });
    expect(result.success).toBe(true);
  });

  it("validates all supported backend types", () => {
    for (const type of ["cursor", "claude-code", "custom"]) {
      const result = AgentTemplateSchema.safeParse({
        ...MINIMAL_TEMPLATE,
        backend: { type },
      });
      expect(result.success).toBe(true);
    }
  });

  it("validates all supported provider types", () => {
    for (const type of ["anthropic", "openai", "custom"]) {
      const result = AgentTemplateSchema.safeParse({
        ...MINIMAL_TEMPLATE,
        provider: { type },
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("DomainContextSchema", () => {
  it("applies defaults for all optional arrays", () => {
    const result = DomainContextSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skills).toEqual([]);
      expect(result.data.prompts).toEqual([]);
      expect(result.data.mcpServers).toEqual([]);
      expect(result.data.subAgents).toEqual([]);
      expect(result.data.workflow).toBeUndefined();
    }
  });

  it("accepts full domain context", () => {
    const result = DomainContextSchema.safeParse({
      skills: ["a", "b"],
      prompts: ["p1"],
      mcpServers: [{ name: "fs", command: "npx", args: ["-y", "fs-server"] }],
      workflow: "trellis",
      subAgents: ["sub-1"],
    });
    expect(result.success).toBe(true);
  });
});

describe("McpServerRefSchema", () => {
  it("validates a complete MCP server reference", () => {
    const result = McpServerRefSchema.safeParse({
      name: "filesystem",
      command: "npx",
      args: ["-y", "@anthropic/mcp-filesystem"],
      env: { HOME: "/tmp" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects MCP server with empty name", () => {
    const result = McpServerRefSchema.safeParse({
      name: "",
      command: "npx",
    });
    expect(result.success).toBe(false);
  });

  it("rejects MCP server with missing command", () => {
    const result = McpServerRefSchema.safeParse({
      name: "test",
    });
    expect(result.success).toBe(false);
  });
});
