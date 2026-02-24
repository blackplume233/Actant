import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { WorkflowManager } from "./workflow-manager";
import { ComponentReferenceError } from "@actant/shared";
import type { WorkflowDefinition } from "@actant/shared";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

function makeWorkflow(name: string): WorkflowDefinition {
  return { name, content: `# ${name} Workflow` };
}

describe("WorkflowManager", () => {
  let mgr: WorkflowManager;

  beforeEach(() => {
    mgr = new WorkflowManager();
  });

  it("should register and retrieve a workflow", () => {
    mgr.register(makeWorkflow("standard"));
    expect(mgr.has("standard")).toBe(true);
    expect(mgr.get("standard")?.content).toBe("# standard Workflow");
  });

  it("should resolve a single workflow by name", () => {
    mgr.register(makeWorkflow("standard"));
    const resolved = mgr.resolve(["standard"]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.name).toBe("standard");
  });

  it("should throw ComponentReferenceError for unresolved name", () => {
    expect(() => mgr.resolve(["missing"])).toThrow(ComponentReferenceError);
  });

  it("should load workflows from fixture directory", async () => {
    const count = await mgr.loadFromDirectory(FIXTURES);
    expect(count).toBe(2);
    expect(mgr.has("trellis-standard")).toBe(true);
    expect(mgr.has("minimal")).toBe(true);
  });

  it("should render workflow content", () => {
    const wf: WorkflowDefinition = { name: "test", content: "# Test\nDo things." };
    expect(mgr.renderWorkflow(wf)).toBe("# Test\nDo things.");
  });

  it("should list all registered workflows", () => {
    mgr.register(makeWorkflow("a"));
    mgr.register(makeWorkflow("b"));
    expect(mgr.list()).toHaveLength(2);
  });

  it("should clear all workflows", () => {
    mgr.register(makeWorkflow("a"));
    mgr.clear();
    expect(mgr.size).toBe(0);
  });
});
