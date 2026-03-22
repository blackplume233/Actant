import type {
  VfsFeature,
  VfsMountRegistration,
  VfsLifecycle,
  VfsHandlerMap,
  VfsFileContent,
  VfsEntry,
  VfsListOptions,
  VfsStatResult,
} from "@actant/shared";

const DOMAIN_TRAITS = new Set<VfsFeature>(["persistent", "watchable"]);

interface MinimalComponent {
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
}

interface ComponentManager {
  list(): MinimalComponent[];
  get(name: string): MinimalComponent | undefined;
  search(query: string): MinimalComponent[];
}

/**
 * Creates a read-only VFS source backed by a BaseComponentManager.
 *
 * Virtual file layout:
 *   /                     → list of component names
 *   /_catalog.json         → full catalog (name + description + tags, no content)
 *   /<name>                → component content (markdown or JSON)
 */
export function createDomainSource(
  manager: ComponentManager,
  domain: string,
  mountPoint: string,
  lifecycle: VfsLifecycle,
): VfsMountRegistration {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const normalized = filePath.replace(/^\/+/, "");

    if (normalized === "_catalog.json") {
      const catalog = manager.list().map((c) => ({
        name: c.name,
        description: c.description,
        tags: c.tags,
      }));
      return { content: JSON.stringify(catalog, null, 2), mimeType: "application/json" };
    }

    const name = normalized.replace(/\.(md|json|ya?ml)$/, "");
    const component = manager.get(name);
    if (!component) throw new Error(`${domain} not found: ${name}`);

    if (component.content) {
      return { content: component.content, mimeType: "text/markdown" };
    }
    return { content: JSON.stringify(component, null, 2), mimeType: "application/json" };
  };

  handlers.list = async (_dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    const components = manager.list();
    const entries: VfsEntry[] = components.map((c) => ({
      name: c.name,
      path: c.name,
      type: "file" as const,
    }));
    entries.unshift({ name: "_catalog.json", path: "_catalog.json", type: "file" as const });
    return entries;
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const normalized = filePath.replace(/^\/+/, "");
    if (normalized === "_catalog.json" || normalized === "") {
      return { size: 0, type: "file", mtime: new Date().toISOString() };
    }
    const name = normalized.replace(/\.(md|json|ya?ml)$/, "");
    const component = manager.get(name);
    if (!component) throw new Error(`${domain} not found: ${name}`);
    const content = component.content ?? JSON.stringify(component);
    return { size: Buffer.byteLength(content), type: "file", mtime: new Date().toISOString() };
  };

  return {
    name: domain,
    mountPoint,
    label: "domain",
    features: new Set(DOMAIN_TRAITS),
    lifecycle,
    metadata: { description: `${domain} components (read-only, virtual)`, virtual: true },
    fileSchema: {},
    handlers,
  };
}
