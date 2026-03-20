import type {
  PermissionConfig,
  PermissionSet,
  ProjectManifest,
  VfsCapabilityId,
  VfsEntry,
  VfsLifecycle,
  VfsPermissionRule,
  VfsSourceRegistration,
  VfsStatResult,
} from "@actant/shared";

const FULL_PROJECT_ACCESS: PermissionConfig = {
  defaults: {
    read: true,
    write: true,
    watch: true,
    stream: true,
  },
};

const READ_ACTIONS: VfsCapabilityId[] = [
  "read",
  "read_range",
  "list",
  "stat",
  "tree",
  "glob",
  "grep",
  "semantic_search",
  "read_lints",
];

const WRITE_ACTIONS: VfsCapabilityId[] = [
  "write",
  "edit",
  "delete",
  "edit_notebook",
];

const WATCH_ACTIONS: VfsCapabilityId[] = [
  "watch",
  "on_change",
];

const STREAM_ACTIONS: VfsCapabilityId[] = [
  "read",
  "read_range",
];

export interface ProjectScopeSnapshot {
  name: string;
  projectRoot: string;
  manifestPath: string | null;
  manifest: ProjectManifest;
  effectivePermissions: PermissionConfig;
  children: ProjectScopeSnapshot[];
}

export interface ProjectManifestProjection {
  name: string;
  projectRoot: string;
  manifestPath: string | null;
  mountPoint: string;
  manifest: ProjectManifest;
  effectivePermissions: PermissionConfig;
  children: Array<{
    name: string;
    mountPoint: string;
    projectRoot: string;
    manifestPath: string | null;
  }>;
}

export function resolveProjectPermissionConfig(
  permissionConfig: PermissionConfig | undefined,
  inherited: PermissionConfig | undefined,
): PermissionConfig {
  const base = inherited ?? FULL_PROJECT_ACCESS;
  if (!permissionConfig) {
    return {
      defaults: { ...base.defaults },
      ...(base.rules?.length
        ? { rules: base.rules.map((rule: NonNullable<PermissionConfig["rules"]>[number]) => ({ ...rule })) }
        : {}),
    };
  }

  const defaults = narrowPermissionSet(base.defaults, permissionConfig.defaults);
  const rules = permissionConfig.rules?.map((rule: NonNullable<PermissionConfig["rules"]>[number]) => ({
    ...rule,
    ...narrowPermissionSet(defaults, rule),
  }));

  return {
    defaults,
    ...(rules?.length ? { rules } : {}),
  };
}

export function createProjectManifestRegistrations(
  project: ProjectScopeSnapshot,
  lifecycle: VfsLifecycle,
  mountPoint = "/",
  namePrefix = "project-manifest",
): VfsSourceRegistration[] {
  const normalizedMountPoint = normalizeMountPoint(mountPoint);
  const registrations: VfsSourceRegistration[] = [
    createProjectManifestRegistration(project, lifecycle, normalizedMountPoint, namePrefix),
  ];

  for (const child of project.children) {
    registrations.push(
      ...createProjectManifestRegistrations(
        child,
        lifecycle,
        joinMountedPath(normalizedMountPoint, "projects", child.name),
        namePrefix,
      ),
    );
  }

  return registrations;
}

export function compileProjectPermissionRules(
  project: ProjectScopeSnapshot,
  mountPoint = "/",
): VfsPermissionRule[] {
  const normalizedMountPoint = normalizeMountPoint(mountPoint);
  const rules = compilePermissionConfig(project.effectivePermissions, normalizedMountPoint);

  for (const child of project.children) {
    rules.push(
      ...compileProjectPermissionRules(
        child,
        joinMountedPath(normalizedMountPoint, "projects", child.name),
      ),
    );
  }

  return rules;
}

function createProjectManifestRegistration(
  project: ProjectScopeSnapshot,
  lifecycle: VfsLifecycle,
  mountPoint: string,
  namePrefix: string,
): VfsSourceRegistration {
  const projection = createProjection(project, mountPoint);

  return {
    name: toRegistrationName(namePrefix, mountPoint),
    mountPoint,
    sourceType: "component-source",
    lifecycle,
    metadata: {
      description: `Project manifest projection for ${project.name}`,
      virtual: true,
      readOnly: true,
      projectName: project.name,
      projectRoot: project.projectRoot,
    },
    fileSchema: {},
    handlers: {
      read: async (filePath: string) => {
        const normalized = normalizeRelativePath(filePath);
        if (normalized !== "_project.json") {
          throw new Error(`Unknown project file: ${filePath}`);
        }
        return {
          content: JSON.stringify(projection, null, 2),
          mimeType: "application/json",
        };
      },
      list: async (dirPath: string) => {
        const normalized = normalizeRelativePath(dirPath);
        if (normalized === "") {
          return listProjectionEntries(projection);
        }
        if (normalized === "projects") {
          return projection.children.map((child) => ({
            name: child.name,
            path: child.mountPoint,
            type: "directory" as const,
          }));
        }
        throw new Error(`Unknown project directory: ${dirPath}`);
      },
      stat: async (filePath: string) => {
        const normalized = normalizeRelativePath(filePath);
        if (normalized === "") {
          return directoryStat();
        }
        if (normalized === "_project.json") {
          return fileStat();
        }
        if (projectionDirectoryNames(projection).has(normalized)) {
          return directoryStat();
        }
        throw new Error(`Unknown project file: ${filePath}`);
      },
    },
  };
}

function createProjection(
  project: ProjectScopeSnapshot,
  mountPoint: string,
): ProjectManifestProjection {
  return {
    name: project.name,
    projectRoot: project.projectRoot,
    manifestPath: project.manifestPath,
    mountPoint,
    manifest: project.manifest,
    effectivePermissions: project.effectivePermissions,
    children: project.children.map((child) => ({
      name: child.name,
      mountPoint: joinMountedPath(mountPoint, "projects", child.name),
      projectRoot: child.projectRoot,
      manifestPath: child.manifestPath,
    })),
  };
}

function listProjectionEntries(
  projection: ProjectManifestProjection,
): VfsEntry[] {
  const entries: VfsEntry[] = [{
    name: "_project.json",
    path: absoluteEntryPath(projection.mountPoint, "_project.json"),
    type: "file",
  }];

  for (const mount of projection.manifest.mounts) {
    const topLevel = normalizeRelativePath(mount.path).split("/")[0];
    if (!topLevel) {
      continue;
    }
    entries.push({
      name: topLevel,
      path: absoluteEntryPath(projection.mountPoint, topLevel),
      type: "directory",
    });
  }

  if (projection.children.length > 0) {
    entries.push({
      name: "projects",
      path: absoluteEntryPath(projection.mountPoint, "projects"),
      type: "directory",
    });
  }

  return dedupeEntries(entries);
}

function projectionDirectoryNames(
  projection: ProjectManifestProjection,
): Set<string> {
  const names = new Set<string>();
  for (const mount of projection.manifest.mounts) {
    const topLevel = normalizeRelativePath(mount.path).split("/")[0];
    if (topLevel) {
      names.add(topLevel);
    }
  }
  if (projection.children.length > 0) {
    names.add("projects");
  }
  return names;
}

function compilePermissionConfig(
  permissionConfig: PermissionConfig,
  mountPoint: string,
): VfsPermissionRule[] {
  const pattern = toProjectPattern(mountPoint);
  const rules = compilePermissionSet(permissionConfig.defaults, {
    pathPattern: pattern,
    principal: { type: "any" },
    allowPriority: 500,
    denyPriority: 550,
    includeUndefined: true,
  });

  for (const rule of permissionConfig.rules ?? []) {
    rules.push(
      ...compilePermissionSet(rule, {
        pathPattern: toScopedPattern(mountPoint, rule.path),
        principal: rule.agent === "*" ? { type: "any" } : { type: "agent", name: rule.agent },
        allowPriority: 600,
        denyPriority: 650,
        includeUndefined: false,
      }),
    );
  }

  return rules;
}

function compilePermissionSet(
  permissionSet: PermissionSet,
  options: {
    pathPattern: string;
    principal: VfsPermissionRule["principal"];
    allowPriority: number;
    denyPriority: number;
    includeUndefined: boolean;
  },
): VfsPermissionRule[] {
  const rules: VfsPermissionRule[] = [];
  const entries: Array<[keyof PermissionSet, VfsCapabilityId[]]> = [
    ["read", READ_ACTIONS],
    ["write", WRITE_ACTIONS],
    ["watch", WATCH_ACTIONS],
    ["stream", STREAM_ACTIONS],
  ];

  for (const [field, actions] of entries) {
    const value = permissionSet[field];
    if (value === undefined && !options.includeUndefined) {
      continue;
    }

    rules.push({
      pathPattern: options.pathPattern,
      principal: options.principal,
      actions,
      effect: value === false ? "deny" : "allow",
      priority: value === false ? options.denyPriority : options.allowPriority,
    });
  }

  return rules;
}

function narrowPermissionSet(
  base: PermissionSet,
  local: PermissionSet | undefined,
): PermissionSet {
  return {
    read: narrowPermissionFlag(base.read, local?.read),
    write: narrowPermissionFlag(base.write, local?.write),
    watch: narrowPermissionFlag(base.watch, local?.watch),
    stream: narrowPermissionFlag(base.stream, local?.stream),
  };
}

function narrowPermissionFlag(
  base: boolean | undefined,
  local: boolean | undefined,
): boolean {
  if (base === false) {
    return false;
  }
  if (local === undefined) {
    return base ?? true;
  }
  return local;
}

function toProjectPattern(mountPoint: string): string {
  return mountPoint === "/" ? "/**" : `${mountPoint}/**`;
}

function toScopedPattern(mountPoint: string, projectPath: string): string {
  const scoped = joinMountedPath(mountPoint, projectPath);
  return scoped.endsWith("/**") || scoped.endsWith("/*") ? scoped : `${scoped.replace(/\/+$/, "")}/**`;
}

function toRegistrationName(namePrefix: string, mountPoint: string): string {
  const suffix = mountPoint === "/"
    ? "root"
    : mountPoint.split("/").filter(Boolean).join("-");
  return `${namePrefix}-${suffix}`;
}

function joinMountedPath(base: string, ...parts: string[]): string {
  const allParts = [
    ...base.split("/").filter(Boolean),
    ...parts.flatMap((part) => part.split("/").filter(Boolean)),
  ];
  return allParts.length === 0 ? "/" : `/${allParts.join("/")}`;
}

function normalizeMountPoint(mountPoint: string): string {
  const normalized = `/${mountPoint}`.replace(/\/+/g, "/");
  return normalized === "/" ? normalized : normalized.replace(/\/+$/, "");
}

function normalizeRelativePath(filePath: string): string {
  if (!filePath || filePath === ".") {
    return "";
  }
  return filePath.replace(/^\/+/, "").replace(/\/+$/, "");
}

function absoluteEntryPath(mountPoint: string, entry: string): string {
  return joinMountedPath(mountPoint, entry);
}

function dedupeEntries(entries: VfsEntry[]): VfsEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.path)) {
      return false;
    }
    seen.add(entry.path);
    return true;
  });
}

function directoryStat(): VfsStatResult {
  return {
    type: "directory",
    size: 0,
    mtime: new Date().toISOString(),
  };
}

function fileStat(): VfsStatResult {
  return {
    type: "file",
    size: 0,
    mtime: new Date().toISOString(),
    mimeType: "application/json",
  };
}
