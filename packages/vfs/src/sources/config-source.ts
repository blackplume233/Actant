import * as fs from "node:fs/promises";
import * as path from "node:path";
import { existsSync } from "node:fs";
import {
  type VfsFeature,
  type FilesystemTypeDefinition,
  type VfsMountRegistration,
  type VfsLifecycle,
  type VfsHandlerMap,
  type VfsFileContent,
  type VfsWriteResult,
  type VfsEditResult,
  type VfsEntry,
  type VfsStatResult,
  type VfsListOptions,
} from "@actant/shared";

export interface ConfigSourceConfig {
  namespace?: string;
}

const CONFIG_TRAITS = new Set<VfsFeature>(["persistent", "writable"]);

function createHandlers(configDir: string): VfsHandlerMap {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const abs = path.resolve(configDir, filePath);
    const content = await fs.readFile(abs, "utf-8");
    return { content, mimeType: filePath.endsWith(".json") ? "application/json" : undefined };
  };

  handlers.write = async (filePath: string, content: string): Promise<VfsWriteResult> => {
    const abs = path.resolve(configDir, filePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const created = !existsSync(abs);
    await fs.writeFile(abs, content, "utf-8");
    return { bytesWritten: Buffer.byteLength(content), created };
  };

  handlers.edit = async (
    filePath: string,
    oldStr: string,
    newStr: string,
    replaceAll?: boolean,
  ): Promise<VfsEditResult> => {
    const abs = path.resolve(configDir, filePath);
    let content = await fs.readFile(abs, "utf-8");
    let replacements = 0;

    if (replaceAll) {
      const parts = content.split(oldStr);
      replacements = parts.length - 1;
      content = parts.join(newStr);
    } else {
      const idx = content.indexOf(oldStr);
      if (idx >= 0) {
        content = content.slice(0, idx) + newStr + content.slice(idx + oldStr.length);
        replacements = 1;
      }
    }

    if (replacements > 0) await fs.writeFile(abs, content, "utf-8");
    return { replacements };
  };

  handlers.list = async (_dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    const abs = path.resolve(configDir, _dirPath || ".");
    const entries = await fs.readdir(abs, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        path: _dirPath ? `${_dirPath}/${e.name}` : e.name,
        type: (e.isDirectory() ? "directory" : "file") as "file" | "directory",
      }));
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const abs = path.resolve(configDir, filePath);
    const stat = await fs.stat(abs);
    return {
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      type: stat.isDirectory() ? "directory" : "file",
    };
  };

  return handlers;
}

export const configSourceFactory: FilesystemTypeDefinition<ConfigSourceConfig> = {
  type: "config",
  label: "config",
  defaultFeatures: CONFIG_TRAITS,

  create(spec: ConfigSourceConfig, mountPoint: string, lifecycle: VfsLifecycle): VfsMountRegistration {
    const configDir = spec.namespace
      ? path.resolve(process.env["ACTANT_HOME"] ?? path.join(process.env["HOME"] ?? "~", ".actant"), "config", spec.namespace)
      : path.resolve(process.env["ACTANT_HOME"] ?? path.join(process.env["HOME"] ?? "~", ".actant"), "config");

    const handlers = createHandlers(configDir);

    return {
      name: "",
      mountPoint,
      label: "config",
      features: new Set(CONFIG_TRAITS),
      lifecycle,
      metadata: {
        description: `Config namespace: ${spec.namespace ?? "root"}`,
      },
      fileSchema: {},
      handlers,
    };
  },
};
