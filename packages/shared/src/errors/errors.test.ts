import { describe, it, expect } from "vitest";
import {
  ActantError,
  ConfigNotFoundError,
  ConfigValidationError,
  TemplateNotFoundError,
  SkillReferenceError,
  CircularReferenceError,
  AgentLaunchError,
  AgentNotFoundError,
  AgentAlreadyRunningError,
  InstanceCorruptedError,
  WorkspaceInitError,
} from "./index";

describe("ActantError hierarchy", () => {
  it("ConfigNotFoundError has correct code and category", () => {
    const err = new ConfigNotFoundError("/path/to/config.json");
    expect(err).toBeInstanceOf(ActantError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("CONFIG_NOT_FOUND");
    expect(err.category).toBe("configuration");
    expect(err.message).toContain("/path/to/config.json");
    expect(err.context).toEqual({ configPath: "/path/to/config.json" });
    expect(err.timestamp).toBeInstanceOf(Date);
    expect(err.name).toBe("ConfigNotFoundError");
  });

  it("ConfigValidationError carries validation details", () => {
    const errors = [
      { path: "name", message: "Required" },
      { path: "version", message: "Invalid format" },
    ];
    const err = new ConfigValidationError("Template validation failed", errors);
    expect(err.code).toBe("CONFIG_VALIDATION_ERROR");
    expect(err.category).toBe("configuration");
    expect(err.validationErrors).toHaveLength(2);
    expect(err.validationErrors[0]?.path).toBe("name");
  });

  it("TemplateNotFoundError includes template name", () => {
    const err = new TemplateNotFoundError("code-reviewer");
    expect(err.code).toBe("TEMPLATE_NOT_FOUND");
    expect(err.message).toContain("code-reviewer");
    expect(err.context).toEqual({ templateName: "code-reviewer" });
  });

  it("SkillReferenceError includes skill name", () => {
    const err = new SkillReferenceError("typescript-expert");
    expect(err.code).toBe("SKILL_REFERENCE_ERROR");
    expect(err.message).toContain("typescript-expert");
  });

  it("CircularReferenceError shows cycle path", () => {
    const cycle = ["agent-a", "agent-b", "agent-c", "agent-a"];
    const err = new CircularReferenceError(cycle);
    expect(err.code).toBe("CIRCULAR_REFERENCE");
    expect(err.message).toContain("agent-a → agent-b → agent-c → agent-a");
    expect(err.context).toEqual({ cyclePath: cycle });
  });

  it("AgentLaunchError wraps cause error", () => {
    const cause = new Error("process exited with code 1");
    const err = new AgentLaunchError("my-agent", cause);
    expect(err.code).toBe("AGENT_LAUNCH_ERROR");
    expect(err.category).toBe("lifecycle");
    expect(err.cause).toBe(cause);
    expect(err.context).toEqual({
      instanceName: "my-agent",
      cause: "process exited with code 1",
    });
  });

  it("AgentNotFoundError has correct properties", () => {
    const err = new AgentNotFoundError("unknown-agent");
    expect(err.code).toBe("AGENT_NOT_FOUND");
    expect(err.message).toContain("unknown-agent");
  });

  it("AgentAlreadyRunningError has correct properties", () => {
    const err = new AgentAlreadyRunningError("running-agent");
    expect(err.code).toBe("AGENT_ALREADY_RUNNING");
    expect(err.message).toContain("running-agent");
  });

  it("InstanceCorruptedError includes reason", () => {
    const err = new InstanceCorruptedError("broken-agent", ".actant.json missing");
    expect(err.code).toBe("INSTANCE_CORRUPTED");
    expect(err.message).toContain("broken-agent");
    expect(err.message).toContain(".actant.json missing");
    expect(err.context).toEqual({
      instanceName: "broken-agent",
      reason: ".actant.json missing",
    });
  });

  it("WorkspaceInitError wraps cause", () => {
    const cause = new Error("EACCES: permission denied");
    const err = new WorkspaceInitError("/tmp/workspace", cause);
    expect(err.code).toBe("WORKSPACE_INIT_ERROR");
    expect(err.category).toBe("lifecycle");
    expect(err.cause).toBe(cause);
  });

  it("all errors extend ActantError", () => {
    const errors = [
      new ConfigNotFoundError("path"),
      new ConfigValidationError("msg", []),
      new TemplateNotFoundError("name"),
      new SkillReferenceError("name"),
      new CircularReferenceError(["a", "b"]),
      new AgentLaunchError("name"),
      new AgentNotFoundError("name"),
      new AgentAlreadyRunningError("name"),
      new InstanceCorruptedError("name", "reason"),
      new WorkspaceInitError("path"),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(ActantError);
      expect(typeof err.code).toBe("string");
      expect(typeof err.category).toBe("string");
    }
  });
});
