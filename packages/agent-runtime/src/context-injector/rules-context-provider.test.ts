import { describe, it, expect } from "vitest";
import type { AgentInstanceMeta } from "@actant/shared/core";
import { RulesContextProvider } from "./rules-context-provider";

function createMeta(overrides: Partial<AgentInstanceMeta> = {}): AgentInstanceMeta {
  return {
    id: "test-agent-id",
    name: "test-agent",
    templateName: "test-template",
    templateVersion: "1.0.0",
    backendType: "claude-code",
    interactionModes: ["chat"],
    status: "running",
    launchMode: "acp-background",
    workspacePolicy: "persistent",
    processOwnership: "managed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archetype: "service",
    autoStart: false,
    ...overrides,
  };
}

describe("RulesContextProvider", () => {
  const provider = new RulesContextProvider();

  it("should return undefined when no rules defined", () => {
    const result = provider.getSystemContext("test-agent", createMeta());
    expect(result).toBeUndefined();
  });

  it("should return undefined for empty rules array", () => {
    const result = provider.getSystemContext("test-agent", createMeta({ rules: [] }));
    expect(result).toBeUndefined();
  });

  it("should render rules as markdown bullet list", () => {
    const rules = [
      "Follow UE5 coding standards",
      "Focus on performance and memory safety",
      "Report issues in structured format",
    ];
    const result = provider.getSystemContext("test-agent", createMeta({ rules }));

    expect(result).toBe(
      "## Rules\n\n" +
      "- Follow UE5 coding standards\n" +
      "- Focus on performance and memory safety\n" +
      "- Report issues in structured format",
    );
  });

  it("should handle single rule", () => {
    const result = provider.getSystemContext(
      "test-agent",
      createMeta({ rules: ["Be concise"] }),
    );
    expect(result).toBe("## Rules\n\n- Be concise");
  });
});
