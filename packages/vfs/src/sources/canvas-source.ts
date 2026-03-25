import {
  type VfsFeature,
  type FilesystemTypeDefinition,
  type VfsMountRegistration,
  type VfsLifecycle,
  type VfsHandlerMap,
  type VfsFileContent,
  type VfsWriteResult,
  type VfsEntry,
  type VfsListOptions,
} from "@actant/shared";

export interface CanvasSourceConfig {
  maxItems?: number;
}

const CANVAS_TRAITS = new Set<VfsFeature>(["ephemeral", "writable"]);

interface CanvasItem {
  id: string;
  content: string;
  updatedAt: number;
}

function createHandlers(items: Map<string, CanvasItem>, maxItems: number): VfsHandlerMap {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const id = filePath.replace(/\.json$/, "");
    const item = items.get(id);
    if (!item) throw new Error(`Canvas item not found: ${id}`);
    return { content: item.content, mimeType: "application/json" };
  };

  handlers.write = async (filePath: string, content: string): Promise<VfsWriteResult> => {
    const id = filePath.replace(/\.json$/, "");
    const created = !items.has(id);

    if (created && items.size >= maxItems) {
      throw new Error(`Canvas max items (${maxItems}) exceeded`);
    }

    items.set(id, { id, content, updatedAt: Date.now() });
    return { bytesWritten: Buffer.byteLength(content), created };
  };

  handlers.list = async (_dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    return Array.from(items.values()).map((item) => ({
      name: `${item.id}.json`,
      path: `${item.id}.json`,
      type: "file" as const,
      size: Buffer.byteLength(item.content),
      mtime: new Date(item.updatedAt).toISOString(),
    }));
  };

  return handlers;
}

export const canvasSourceFactory: FilesystemTypeDefinition<CanvasSourceConfig> = {
  type: "canvas",
  label: "canvas",
  defaultFeatures: CANVAS_TRAITS,

  create(spec: CanvasSourceConfig, mountPoint: string, lifecycle: VfsLifecycle): VfsMountRegistration {
    const items = new Map<string, CanvasItem>();
    const maxItems = spec.maxItems ?? 100;
    const handlers = createHandlers(items, maxItems);

    return {
      name: "",
      mountPoint,
      label: "canvas",
      features: new Set(CANVAS_TRAITS),
      lifecycle,
      metadata: {
        description: "Canvas data store",
        virtual: true,
        filesystemType: "memfs",
        mountType: mountPoint === "/" ? "root" : "direct",
      },
      fileSchema: {},
      handlers,
    };
  },
};
