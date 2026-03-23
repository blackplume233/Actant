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

export interface DomainComponentSnapshot {
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
}

interface ComponentManager {
  list(): DomainComponentSnapshot[];
  get(name: string): DomainComponentSnapshot | undefined;
  search(query: string): DomainComponentSnapshot[];
}

interface ComponentView {
  list(): DomainComponentSnapshot[];
  get(name: string): DomainComponentSnapshot | undefined;
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
  return createDomainRegistration(manager, domain, mountPoint, lifecycle, {
    description: `${domain} components (read-only, virtual)`,
    virtual: true,
  });
}

/**
 * Creates a read-only VFS source backed by a frozen component snapshot.
 *
 * The returned registration is intentionally detached from later manager mutations so
 * standalone/project-context mounts no longer treat manager state as the live source of truth.
 */
export function createSnapshotDomainSource(
  components: DomainComponentSnapshot[],
  domain: string,
  mountPoint: string,
  lifecycle: VfsLifecycle,
): VfsMountRegistration {
  const snapshot = components.map((component) => ({
    ...component,
    tags: component.tags ? [...component.tags] : undefined,
  }));
  const index = new Map(snapshot.map((component) => [component.name, component]));

  return createDomainRegistration(
    {
      list: () => snapshot,
      get: (name) => index.get(name),
    },
    domain,
    mountPoint,
    lifecycle,
    {
      description: `${domain} components (read-only, snapshot-backed)`,
      virtual: true,
      snapshot: true,
    },
  );
}

function createDomainRegistration(
  source: ComponentView,
  domain: string,
  mountPoint: string,
  lifecycle: VfsLifecycle,
  metadata: Record<string, unknown>,
): VfsMountRegistration {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const normalized = filePath.replace(/^\/+/, "");

    if (normalized === "_catalog.json") {
      const catalog = source.list().map((c) => ({
        name: c.name,
        description: c.description,
        tags: c.tags,
      }));
      return { content: JSON.stringify(catalog, null, 2), mimeType: "application/json" };
    }

    const name = normalized.replace(/\.(md|json|ya?ml)$/, "");
    const component = source.get(name);
    if (!component) throw new Error(`${domain} not found: ${name}`);

    if (component.content) {
      return { content: component.content, mimeType: "text/markdown" };
    }
    return { content: JSON.stringify(component, null, 2), mimeType: "application/json" };
  };

  handlers.list = async (_dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    const components = source.list();
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
    const component = source.get(name);
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
    metadata,
    fileSchema: {},
    handlers,
  };
}
