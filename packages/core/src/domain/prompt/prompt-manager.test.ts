import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { PromptManager } from "./prompt-manager";
import { ComponentReferenceError } from "@actant/shared";
import type { PromptDefinition } from "@actant/shared";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

function makePrompt(name: string, content?: string): PromptDefinition {
  return { name, content: content ?? `Prompt for ${name}` };
}

describe("PromptManager", () => {
  let mgr: PromptManager;

  beforeEach(() => {
    mgr = new PromptManager();
  });

  it("should register and retrieve a prompt", () => {
    mgr.register(makePrompt("a"));
    expect(mgr.has("a")).toBe(true);
    expect(mgr.get("a")?.content).toBe("Prompt for a");
  });

  it("should resolve multiple prompts by name", () => {
    mgr.register(makePrompt("a"));
    mgr.register(makePrompt("b"));
    const resolved = mgr.resolve(["b", "a"]);
    expect(resolved.map((p) => p.name)).toEqual(["b", "a"]);
  });

  it("should throw ComponentReferenceError for unresolved name", () => {
    expect(() => mgr.resolve(["nonexistent"])).toThrow(ComponentReferenceError);
  });

  it("should load prompts from fixture directory", async () => {
    const count = await mgr.loadFromDirectory(FIXTURES);
    expect(count).toBe(2);
    expect(mgr.has("system-reviewer")).toBe(true);
    expect(mgr.has("style-guide")).toBe(true);
  });

  it("should render prompt with variable interpolation", () => {
    const prompt: PromptDefinition = {
      name: "test",
      content: "Hello {{name}}, welcome to {{project}}!",
      variables: ["name", "project"],
    };
    const rendered = mgr.renderPrompt(prompt, { name: "Alice", project: "Actant" });
    expect(rendered).toBe("Hello Alice, welcome to Actant!");
  });

  it("should preserve unresolved variables when value not provided", () => {
    const prompt: PromptDefinition = {
      name: "test",
      content: "Hello {{name}}, env: {{env}}",
    };
    const rendered = mgr.renderPrompt(prompt, { name: "Bob" });
    expect(rendered).toBe("Hello Bob, env: {{env}}");
  });

  it("should return content as-is when no variables provided", () => {
    const prompt = makePrompt("test", "No variables here");
    expect(mgr.renderPrompt(prompt)).toBe("No variables here");
  });

  it("should render multiple prompts into system.md format", () => {
    const prompts: PromptDefinition[] = [
      { name: "role", description: "Role definition", content: "You are a helper" },
      { name: "rules", content: "Follow rules" },
    ];
    const output = mgr.renderPrompts(prompts);
    expect(output).toContain("## role");
    expect(output).toContain("> Role definition");
    expect(output).toContain("You are a helper");
    expect(output).toContain("## rules");
  });
});
