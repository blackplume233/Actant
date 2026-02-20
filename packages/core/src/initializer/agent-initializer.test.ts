import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, access, mkdir, writeFile, lstat, readlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentTemplate } from "@agentcraft/shared";
import {
  TemplateNotFoundError,
  ConfigValidationError,
  InstanceCorruptedError,
} from "@agentcraft/shared";
import { TemplateRegistry } from "../template/registry/template-registry";
import { AgentInitializer } from "./agent-initializer";

function makeTemplate(overrides?: Partial<AgentTemplate>): AgentTemplate {
  return {
    name: "test-template",
    version: "1.0.0",
    backend: { type: "cursor" },
    provider: { type: "openai" },
    domainContext: {
      skills: ["skill-a", "skill-b"],
      prompts: ["system-prompt"],
      mcpServers: [
        { name: "fs", command: "npx", args: ["-y", "mcp-fs"] },
      ],
      workflow: "standard",
    },
    ...overrides,
  };
}

describe("AgentInitializer", () => {
  let tmpDir: string;
  let registry: TemplateRegistry;
  let initializer: AgentInitializer;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "agentcraft-init-test-"));
    registry = new TemplateRegistry();
    registry.register(makeTemplate());
    initializer = new AgentInitializer(registry, tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("createInstance", () => {
    it("should create instance directory with .agentcraft.json", async () => {
      const meta = await initializer.createInstance("my-agent", "test-template");

      expect(meta.name).toBe("my-agent");
      expect(meta.templateName).toBe("test-template");
      expect(meta.templateVersion).toBe("1.0.0");
      expect(meta.backendType).toBe("cursor");
      expect(meta.status).toBe("created");
      expect(meta.launchMode).toBe("direct");
      expect(meta.id).toBeTruthy();

      const metaRaw = await readFile(join(tmpDir, "my-agent", ".agentcraft.json"), "utf-8");
      const metaParsed = JSON.parse(metaRaw);
      expect(metaParsed.name).toBe("my-agent");
    });

    it("should materialize domain context files", async () => {
      await initializer.createInstance("my-agent", "test-template");
      const base = join(tmpDir, "my-agent");

      const agents = await readFile(join(base, "AGENTS.md"), "utf-8");
      expect(agents).toContain("skill-a");
      expect(agents).toContain("skill-b");

      const mcp = JSON.parse(await readFile(join(base, ".cursor", "mcp.json"), "utf-8"));
      expect(mcp.mcpServers.fs.command).toBe("npx");

      const workflow = await readFile(join(base, ".trellis", "workflow.md"), "utf-8");
      expect(workflow).toContain("standard");

      const prompts = await readFile(join(base, "prompts", "system.md"), "utf-8");
      expect(prompts).toContain("system-prompt");
    });

    it("should materialize to .claude/ for claude-code backend", async () => {
      registry.register(
        makeTemplate({
          name: "claude-template",
          backend: { type: "claude-code", config: { executablePath: "/usr/bin/claude" } },
          domainContext: { mcpServers: [{ name: "m1", command: "cmd", args: [] }] },
        }),
      );
      const meta = await initializer.createInstance("claude-agent", "claude-template");
      expect(meta.backendType).toBe("claude-code");
      expect(meta.backendConfig).toEqual({ executablePath: "/usr/bin/claude" });

      const base = join(tmpDir, "claude-agent");
      const mcp = JSON.parse(await readFile(join(base, ".claude", "mcp.json"), "utf-8"));
      expect(mcp.mcpServers.m1.command).toBe("cmd");
    });

    it("should throw TemplateNotFoundError for missing template", async () => {
      await expect(
        initializer.createInstance("my-agent", "nonexistent-template"),
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it("should throw ConfigValidationError if name conflicts", async () => {
      await initializer.createInstance("my-agent", "test-template");
      await expect(
        initializer.createInstance("my-agent", "test-template"),
      ).rejects.toThrow(ConfigValidationError);
    });

    it("should respect launch mode override", async () => {
      const meta = await initializer.createInstance("my-agent", "test-template", {
        launchMode: "one-shot",
      });
      expect(meta.launchMode).toBe("one-shot");
    });

    it("should respect metadata override", async () => {
      const meta = await initializer.createInstance("my-agent", "test-template", {
        metadata: { env: "staging" },
      });
      expect(meta.metadata).toEqual({ env: "staging" });
    });

    it("should use defaultLaunchMode from options when no override", async () => {
      initializer = new AgentInitializer(registry, tmpDir, {
        defaultLaunchMode: "acp-service",
      });
      const meta = await initializer.createInstance("my-agent", "test-template");
      expect(meta.launchMode).toBe("acp-service");
    });

    it("should default workspacePolicy to persistent for non-one-shot modes", async () => {
      const meta = await initializer.createInstance("persist-agent", "test-template");
      expect(meta.workspacePolicy).toBe("persistent");
    });

    it("should default workspacePolicy to ephemeral for one-shot mode", async () => {
      const meta = await initializer.createInstance("ephemeral-agent", "test-template", {
        launchMode: "one-shot",
      });
      expect(meta.workspacePolicy).toBe("ephemeral");
    });

    it("should respect explicit workspacePolicy override", async () => {
      const meta = await initializer.createInstance("custom-policy", "test-template", {
        launchMode: "one-shot",
        workspacePolicy: "persistent",
      });
      expect(meta.workspacePolicy).toBe("persistent");
    });

    it("should create instance with minimal template (empty domainContext)", async () => {
      registry.register(makeTemplate({
        name: "minimal",
        domainContext: {},
      }));
      const meta = await initializer.createInstance("minimal-agent", "minimal");

      expect(meta.name).toBe("minimal-agent");
      await expect(access(join(tmpDir, "minimal-agent", ".agentcraft.json"))).resolves.toBeUndefined();
    });
  });

  describe("findOrCreateInstance", () => {
    it("should create new instance when not found", async () => {
      const { meta, created } = await initializer.findOrCreateInstance(
        "new-agent",
        "test-template",
      );

      expect(created).toBe(true);
      expect(meta.name).toBe("new-agent");
      expect(meta.status).toBe("created");
    });

    it("should return existing instance without recreating", async () => {
      const original = await initializer.createInstance("existing", "test-template");
      const { meta, created } = await initializer.findOrCreateInstance(
        "existing",
        "test-template",
      );

      expect(created).toBe(false);
      expect(meta.id).toBe(original.id);
      expect(meta.name).toBe("existing");
    });

    it("should throw InstanceCorruptedError for corrupted directory", async () => {
      const corruptedDir = join(tmpDir, "corrupted");
      await mkdir(corruptedDir);
      await writeFile(join(corruptedDir, ".agentcraft.json"), "invalid", "utf-8");

      await expect(
        initializer.findOrCreateInstance("corrupted", "test-template"),
      ).rejects.toThrow(InstanceCorruptedError);
    });
  });

  describe("createInstance with custom workDir", () => {
    let customDir: string;

    beforeEach(async () => {
      customDir = await mkdtemp(join(tmpdir(), "agentcraft-workdir-test-"));
    });

    afterEach(async () => {
      await rm(customDir, { recursive: true, force: true }).catch(() => {});
    });

    it("should create instance in a custom directory and symlink from instancesBaseDir", async () => {
      const targetDir = join(customDir, "my-project");
      const meta = await initializer.createInstance("custom-agent", "test-template", {
        workDir: targetDir,
      });

      expect(meta.name).toBe("custom-agent");

      const metaRaw = await readFile(join(targetDir, ".agentcraft.json"), "utf-8");
      expect(JSON.parse(metaRaw).name).toBe("custom-agent");

      const linkStat = await lstat(join(tmpDir, "custom-agent"));
      expect(linkStat.isSymbolicLink()).toBe(true);

      const linkTarget = await readlink(join(tmpDir, "custom-agent"));
      expect(linkTarget).toBe(targetDir);
    });

    it("should materialize domain context files into custom workDir", async () => {
      const targetDir = join(customDir, "project-with-agent");
      await initializer.createInstance("ctx-agent", "test-template", {
        workDir: targetDir,
      });

      const agents = await readFile(join(targetDir, "AGENTS.md"), "utf-8");
      expect(agents).toContain("skill-a");
    });

    it("should error by default when custom workDir already exists", async () => {
      await mkdir(join(customDir, "existing-project"));
      await expect(
        initializer.createInstance("exist-agent", "test-template", {
          workDir: join(customDir, "existing-project"),
        }),
      ).rejects.toThrow(ConfigValidationError);
    });

    it("should overwrite existing directory when workDirConflict is 'overwrite'", async () => {
      const target = join(customDir, "overwrite-project");
      await mkdir(target, { recursive: true });
      await writeFile(join(target, "old-file.txt"), "old content");

      const meta = await initializer.createInstance("overwrite-agent", "test-template", {
        workDir: target,
        workDirConflict: "overwrite",
      });

      expect(meta.name).toBe("overwrite-agent");
      await expect(access(join(target, "old-file.txt"))).rejects.toThrow();
      await expect(access(join(target, ".agentcraft.json"))).resolves.toBeUndefined();
    });

    it("should append to existing directory when workDirConflict is 'append'", async () => {
      const target = join(customDir, "append-project");
      await mkdir(target, { recursive: true });
      await writeFile(join(target, "existing-file.txt"), "keep me");

      const meta = await initializer.createInstance("append-agent", "test-template", {
        workDir: target,
        workDirConflict: "append",
      });

      expect(meta.name).toBe("append-agent");
      const kept = await readFile(join(target, "existing-file.txt"), "utf-8");
      expect(kept).toBe("keep me");
      await expect(access(join(target, ".agentcraft.json"))).resolves.toBeUndefined();
    });

    it("should error when instance name already registered in instancesBaseDir", async () => {
      await initializer.createInstance("taken-name", "test-template");
      await expect(
        initializer.createInstance("taken-name", "test-template", {
          workDir: join(customDir, "new-project"),
        }),
      ).rejects.toThrow(ConfigValidationError);
    });
  });

  describe("destroyInstance", () => {
    it("should remove the instance directory completely", async () => {
      await initializer.createInstance("to-destroy", "test-template");
      await initializer.destroyInstance("to-destroy");

      await expect(access(join(tmpDir, "to-destroy"))).rejects.toThrow();
    });

    it("should not throw when destroying non-existent instance", async () => {
      await expect(
        initializer.destroyInstance("nonexistent"),
      ).resolves.toBeUndefined();
    });

    it("should remove symlink but preserve custom workDir content", async () => {
      const customDir = await mkdtemp(join(tmpdir(), "agentcraft-destroy-test-"));
      try {
        const targetDir = join(customDir, "user-project");
        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, "readme.md"), "My project");

        await initializer.createInstance("linked-agent", "test-template", {
          workDir: targetDir,
          workDirConflict: "append",
        });

        await initializer.destroyInstance("linked-agent");

        await expect(access(join(tmpDir, "linked-agent"))).rejects.toThrow();
        const readme = await readFile(join(targetDir, "readme.md"), "utf-8");
        expect(readme).toBe("My project");
        await expect(access(join(targetDir, ".agentcraft.json"))).rejects.toThrow();
      } finally {
        await rm(customDir, { recursive: true, force: true });
      }
    });
  });
});
