import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { VfsEntry, VfsFileContent } from "@actant/shared";
import { VfsRegistry } from "@actant/vfs";
import { ContextManager } from "../manager/context-manager";
import { UnrealProjectSource } from "../sources/unreal-project-source";

describe("UnrealProjectSource", () => {
  let projectDir: string;
  let cm: ContextManager;
  let registry: VfsRegistry;

  beforeAll(async () => {
    projectDir = join(tmpdir(), `actant-ue-test-${Date.now()}`);

    await mkdir(join(projectDir, "Source", "Characters", "Private"), { recursive: true });
    await mkdir(join(projectDir, "Source", "Characters", "Public"), { recursive: true });
    await mkdir(join(projectDir, "Source", "Gameplay"), { recursive: true });
    await mkdir(join(projectDir, "Plugins", "CustomPlugin"), { recursive: true });
    await mkdir(join(projectDir, "Config"), { recursive: true });
    await mkdir(join(projectDir, "Content"), { recursive: true });

    await writeFile(
      join(projectDir, "TestGame.uproject"),
      JSON.stringify({
        EngineAssociation: "5.4",
        Description: "A test game project",
        Category: "Game",
        TargetPlatforms: ["Win64", "Linux"],
        Modules: [
          { Name: "Characters", Type: "Runtime", LoadingPhase: "Default" },
          { Name: "Gameplay", Type: "Runtime", LoadingPhase: "Default" },
        ],
      }),
    );

    await writeFile(
      join(projectDir, "Source", "Characters", "Characters.Build.cs"),
      'using UnrealBuildTool;\npublic class Characters : ModuleRules { }',
    );
    await writeFile(
      join(projectDir, "Source", "Characters", "Public", "CharacterBase.h"),
      '#pragma once\nclass ACharacterBase : public ACharacter { };',
    );
    await writeFile(
      join(projectDir, "Source", "Characters", "Public", "PlayerCharacter.h"),
      '#pragma once\nclass APlayerCharacter : public ACharacterBase { };',
    );
    await writeFile(
      join(projectDir, "Source", "Characters", "Private", "CharacterBase.cpp"),
      '#include "CharacterBase.h"',
    );

    await writeFile(
      join(projectDir, "Source", "Gameplay", "Gameplay.Build.cs"),
      'using UnrealBuildTool;\npublic class Gameplay : ModuleRules { }',
    );

    await writeFile(
      join(projectDir, "Plugins", "CustomPlugin", "CustomPlugin.uplugin"),
      JSON.stringify({ FriendlyName: "Custom Plugin" }),
    );

    await writeFile(
      join(projectDir, "Config", "DefaultEngine.ini"),
      "[/Script/Engine.Engine]\n+ActiveGameNameRedirects=(OldGameName=\"TestGame\")",
    );
    await writeFile(
      join(projectDir, "Config", "DefaultGame.ini"),
      "[/Script/EngineSettings.GeneralProjectSettings]\nProjectID=ABC123",
    );
  });

  afterAll(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("should scan UE project and produce overview", async () => {
    cm = new ContextManager();
    registry = new VfsRegistry();

    const source = new UnrealProjectSource(projectDir);
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/project/overview.json");
    expect(resolved).not.toBeNull();

    const result: VfsFileContent = await resolved!.source.handlers.read!(resolved!.relativePath);
    const overview = JSON.parse(result.content) as {
      name: string;
      engineVersion: string;
      modules: Array<{ name: string }>;
      plugins: string[];
    };

    expect(overview.name).toBe("TestGame");
    expect(overview.engineVersion).toBe("5.4");
    expect(overview.modules).toHaveLength(2);
    expect(overview.modules.map((m) => m.name).sort()).toEqual(["Characters", "Gameplay"]);
    expect(overview.plugins).toContain("CustomPlugin");
  });

  it("should list modules", async () => {
    cm = new ContextManager();
    registry = new VfsRegistry();

    const source = new UnrealProjectSource(projectDir);
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/project/modules");
    const entries: VfsEntry[] = await resolved!.source.handlers.list!(resolved!.relativePath);

    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(["Characters", "Gameplay"]);
  });

  it("should read module summary with header count", async () => {
    cm = new ContextManager();
    registry = new VfsRegistry();

    const source = new UnrealProjectSource(projectDir);
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/project/modules/Characters/_summary.json");
    const result: VfsFileContent = await resolved!.source.handlers.read!(resolved!.relativePath);
    const mod = JSON.parse(result.content) as { name: string; classCount: number };

    expect(mod.name).toBe("Characters");
    expect(mod.classCount).toBe(2);
  });

  it("should list config files", async () => {
    cm = new ContextManager();
    registry = new VfsRegistry();

    const source = new UnrealProjectSource(projectDir);
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/project/config");
    const entries: VfsEntry[] = await resolved!.source.handlers.list!(resolved!.relativePath);

    const names = entries.map((e) => e.name).sort();
    expect(names).toContain("DefaultEngine.ini");
    expect(names).toContain("DefaultGame.ini");
  });

  it("should read config file content", async () => {
    cm = new ContextManager();
    registry = new VfsRegistry();

    const source = new UnrealProjectSource(projectDir);
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/project/config/DefaultEngine.ini");
    const result: VfsFileContent = await resolved!.source.handlers.read!(resolved!.relativePath);

    expect(result.content).toContain("[/Script/Engine.Engine]");
  });

  it("should list root entries", async () => {
    cm = new ContextManager();
    registry = new VfsRegistry();

    const source = new UnrealProjectSource(projectDir);
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/project/");
    const entries: VfsEntry[] = await resolved!.source.handlers.list!(resolved!.relativePath);

    const names = entries.map((e) => e.name);
    expect(names).toContain("overview.json");
    expect(names).toContain("modules");
    expect(names).toContain("config");
  });

  it("should throw for non-existent module", async () => {
    cm = new ContextManager();
    registry = new VfsRegistry();

    const source = new UnrealProjectSource(projectDir);
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/project/modules/NonExistent/_summary.json");
    await expect(
      resolved!.source.handlers.read!(resolved!.relativePath),
    ).rejects.toThrow("Module not found: NonExistent");
  });
});
