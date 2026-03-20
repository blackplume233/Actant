import type {
  VfsSourceRegistration,
  VfsFileSchemaMap,
  VfsLifecycle,
  VfsHandlerMap,
  VfsFileContent,
  VfsEntry,
  VfsListOptions,
  VfsStatResult,
  VfsWriteResult,
} from "@actant/shared";

interface SkillRecord {
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
}

interface SkillManagerLike {
  list(): SkillRecord[];
  get(name: string): SkillRecord | undefined;
  add(skill: SkillRecord, persist?: boolean): Promise<void>;
  update(name: string, patch: Partial<SkillRecord>, persist?: boolean): Promise<SkillRecord>;
}

const SKILL_FILE_SCHEMA: VfsFileSchemaMap = {
  "_catalog.json": {
    type: "json",
    mimeType: "application/json",
    capabilities: ["read", "stat"],
  },
  "skill": {
    type: "text",
    mimeType: "text/markdown",
    capabilities: ["read", "write", "stat"],
  },
};

function normalizePath(filePath: string): string {
  return filePath.replace(/^\/+/, "").replace(/\/+$/, "");
}

function resolveSkillName(filePath: string): string {
  const normalized = normalizePath(filePath);
  if (!normalized || normalized === "_catalog.json" || normalized.includes("/")) {
    throw new Error(`Skill path not found: ${filePath}`);
  }
  return normalized.replace(/\.(md|json|ya?ml)$/i, "");
}

function toCatalogEntry(skill: SkillRecord): Record<string, unknown> {
  return {
    name: skill.name,
    description: skill.description,
    tags: skill.tags,
  };
}

function parseSkillWrite(name: string, content: string, existing?: SkillRecord): SkillRecord {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed == null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("Skill payload must be a JSON object");
    }
    if ("name" in parsed && parsed.name !== name) {
      throw new Error(`Skill payload name "${String(parsed.name)}" does not match path "${name}"`);
    }
    return {
      name,
      description: typeof parsed.description === "string" ? parsed.description : existing?.description,
      content: typeof parsed.content === "string" ? parsed.content : existing?.content,
      tags: Array.isArray(parsed.tags) ? parsed.tags as string[] : existing?.tags,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        ...existing,
        name,
        content,
      };
    }
    throw error;
  }
}

export function createSkillSource(
  manager: SkillManagerLike,
  mountPoint: string,
  lifecycle: VfsLifecycle,
): VfsSourceRegistration {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const normalized = normalizePath(filePath);

    if (normalized === "_catalog.json") {
      const catalog = manager.list().map(toCatalogEntry);
      return {
        content: JSON.stringify(catalog, null, 2),
        mimeType: "application/json",
      };
    }

    const name = resolveSkillName(filePath);
    const skill = manager.get(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    if (typeof skill.content === "string") {
      return { content: skill.content, mimeType: "text/markdown" };
    }

    return {
      content: JSON.stringify(skill, null, 2),
      mimeType: "application/json",
    };
  };

  handlers.write = async (filePath: string, content: string): Promise<VfsWriteResult> => {
    const name = resolveSkillName(filePath);
    const existing = manager.get(name);
    const skill = parseSkillWrite(name, content, existing);

    if (existing) {
      await manager.update(name, skill, true);
    } else {
      await manager.add(skill, true);
    }

    return {
      bytesWritten: Buffer.byteLength(content),
      created: existing == null,
    };
  };

  handlers.list = async (dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    const normalized = normalizePath(dirPath);
    if (normalized) {
      throw new Error(`Skill path not found: ${dirPath}`);
    }

    const entries = manager.list().map((skill) => ({
      name: skill.name,
      path: skill.name,
      type: "file" as const,
    }));
    entries.unshift({
      name: "_catalog.json",
      path: "_catalog.json",
      type: "file" as const,
    });
    return entries;
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const normalized = normalizePath(filePath);
    if (!normalized) {
      return { size: 0, type: "directory", mtime: new Date().toISOString() };
    }
    if (normalized === "_catalog.json") {
      return { size: 0, type: "file", mtime: new Date().toISOString(), mimeType: "application/json" };
    }

    const name = resolveSkillName(filePath);
    const skill = manager.get(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    const serialized = typeof skill.content === "string" ? skill.content : JSON.stringify(skill);
    return {
      size: Buffer.byteLength(serialized),
      type: "file",
      mtime: new Date().toISOString(),
      mimeType: typeof skill.content === "string" ? "text/markdown" : "application/json",
    };
  };

  return {
    name: "skills",
    mountPoint,
    sourceType: "component-source",
    lifecycle,
    metadata: { description: "Built-in skill source", virtual: true },
    fileSchema: SKILL_FILE_SCHEMA,
    handlers,
  };
}
