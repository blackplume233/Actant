import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, access, writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { StepContext } from "../pipeline/types";
import type { AgentTemplate } from "@actant/shared/core";
import { MkdirStep } from "./mkdir-step";
import { ExecStep } from "./exec-step";
import { FileCopyStep } from "./file-copy-step";
import { FileTemplateStep } from "./file-template-step";
import { WriteFileStep } from "./write-file-step";

function makeContext(workspaceDir: string): StepContext {
  return {
    workspaceDir,
    instanceMeta: { name: "test" },
    template: {
      name: "t",
      version: "1.0.0",
      backend: { type: "cursor" },
      provider: { type: "openai" },
      project: {},
    } as AgentTemplate,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    state: new Map(),
  };
}

describe("MkdirStep", () => {
  let tmpDir: string;
  const step = new MkdirStep();

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-mkdir-test-"));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should have type 'mkdir'", () => {
    expect(step.type).toBe("mkdir");
  });

  it("should validate config", () => {
    expect(step.validate({ paths: ["a", "b"] }).valid).toBe(true);
    expect(step.validate({ paths: [] }).valid).toBe(false);
    expect(step.validate({}).valid).toBe(false);
    expect(step.validate({ paths: ["/absolute"] }).valid).toBe(false);
  });

  it("should create directories", async () => {
    const result = await step.execute(makeContext(tmpDir), { paths: ["sub/dir", "other"] });
    expect(result.success).toBe(true);
    await expect(access(join(tmpDir, "sub", "dir"))).resolves.toBeUndefined();
    await expect(access(join(tmpDir, "other"))).resolves.toBeUndefined();
  });

  it("should rollback created directories", async () => {
    await step.execute(makeContext(tmpDir), { paths: ["rollback-dir"] });
    await step.rollback!(makeContext(tmpDir), { paths: ["rollback-dir"] }, new Error("test"));
    await expect(access(join(tmpDir, "rollback-dir"))).rejects.toThrow();
  });
});

describe("ExecStep", () => {
  let tmpDir: string;
  const step = new ExecStep();

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-exec-test-"));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should have type 'exec'", () => {
    expect(step.type).toBe("exec");
  });

  it("should validate config", () => {
    expect(step.validate({ command: "echo" }).valid).toBe(true);
    expect(step.validate({}).valid).toBe(false);
    expect(step.validate({ command: "" }).valid).toBe(false);
  });

  it("should execute a command successfully", async () => {
    const result = await step.execute(makeContext(tmpDir), { command: "echo", args: ["hello"] });
    expect(result.success).toBe(true);
    expect((result.output as Record<string, unknown>).exitCode).toBe(0);
  });

  it("should report failure for bad command", async () => {
    const result = await step.execute(makeContext(tmpDir), {
      command: "nonexistent-cmd-12345",
      args: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("FileCopyStep", () => {
  let tmpDir: string;
  const step = new FileCopyStep();

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-filecopy-test-"));
    await mkdir(join(tmpDir, "source"), { recursive: true });
    await writeFile(join(tmpDir, "source", "file.txt"), "hello");
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should have type 'file-copy'", () => {
    expect(step.type).toBe("file-copy");
  });

  it("should validate config", () => {
    expect(step.validate({ from: "a", to: "b" }).valid).toBe(true);
    expect(step.validate({ from: "", to: "b" }).valid).toBe(false);
    expect(step.validate({ from: "a", to: "" }).valid).toBe(false);
    expect(step.validate({ from: "a", to: "/absolute" }).valid).toBe(false);
  });

  it("should copy files", async () => {
    const result = await step.execute(makeContext(tmpDir), { from: "source", to: "dest" });
    expect(result.success).toBe(true);
    await expect(access(join(tmpDir, "dest", "file.txt"))).resolves.toBeUndefined();
  });

  it("should fail if source does not exist", async () => {
    const result = await step.execute(makeContext(tmpDir), { from: "nonexistent", to: "dest" });
    expect(result.success).toBe(false);
  });

  it("should rollback by removing destination", async () => {
    await step.execute(makeContext(tmpDir), { from: "source", to: "rollback-dest" });
    await step.rollback!(makeContext(tmpDir), { from: "source", to: "rollback-dest" }, new Error("test"));
    await expect(access(join(tmpDir, "rollback-dest"))).rejects.toThrow();
  });
});

describe("FileTemplateStep", () => {
  let tmpDir: string;
  const step = new FileTemplateStep();

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-filetemplate-test-"));
    await writeFile(join(tmpDir, "template.txt"), "Hello {{name}} from {{place}}!");
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should have type 'file-template'", () => {
    expect(step.type).toBe("file-template");
  });

  it("should validate config", () => {
    expect(step.validate({ template: "template.txt", output: "out.txt" }).valid).toBe(true);
    expect(step.validate({ template: "", output: "out.txt" }).valid).toBe(false);
    expect(step.validate({ template: "template.txt", output: "/abs/out.txt" }).valid).toBe(false);
  });

  it("should render template variables into output", async () => {
    const result = await step.execute(makeContext(tmpDir), {
      template: "template.txt",
      output: "rendered.txt",
      variables: { name: "Actant", place: "workspace" },
    });
    expect(result.success).toBe(true);
    const rendered = await readFile(join(tmpDir, "rendered.txt"), "utf-8");
    expect(rendered).toBe("Hello Actant from workspace!");
  });
});

describe("WriteFileStep", () => {
  let tmpDir: string;
  const step = new WriteFileStep();

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-writefile-test-"));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should have type 'write-file'", () => {
    expect(step.type).toBe("write-file");
  });

  it("should validate config", () => {
    expect(step.validate({ path: "README.md", content: "hello" }).valid).toBe(true);
    expect(step.validate({ path: "", content: "hello" }).valid).toBe(false);
    expect(step.validate({ path: "/abs/file", content: "hello" }).valid).toBe(false);
  });

  it("should write file content", async () => {
    const result = await step.execute(makeContext(tmpDir), { path: "notes/info.txt", content: "hello" });
    expect(result.success).toBe(true);
    const content = await readFile(join(tmpDir, "notes", "info.txt"), "utf-8");
    expect(content).toBe("hello");
  });
});
