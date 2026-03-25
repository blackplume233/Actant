import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type {
  ActantNamespaceConfig,
  MountDeclaration,
  NamespaceValidateResult,
  NamespaceValidationIssue,
} from "@actant/shared";

export const NAMESPACE_CONFIG_FILENAME = "actant.namespace.json";
const LEGACY_CONFIG_FILENAME = "actant.project.json";

export interface NamespaceConfigDocument {
  projectRoot: string;
  configPath: string | null;
  exists: boolean;
  config: ActantNamespaceConfig;
}

export function createDefaultNamespaceConfig(projectRoot: string): ActantNamespaceConfig {
  return {
    version: 1,
    name: basename(projectRoot),
    mounts: [],
  };
}

export async function readNamespaceConfigDocument(projectRoot: string): Promise<NamespaceConfigDocument> {
  const resolvedRoot = resolve(projectRoot);
  const configPath = join(resolvedRoot, NAMESPACE_CONFIG_FILENAME);
  if (await pathExists(configPath)) {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ActantNamespaceConfig>;
    return {
      projectRoot: resolvedRoot,
      configPath,
      exists: true,
      config: normalizeNamespaceConfig(parsed, resolvedRoot),
    };
  }

  const legacyPath = join(resolvedRoot, LEGACY_CONFIG_FILENAME);
  if (await pathExists(legacyPath)) {
    throw new Error(
      `Legacy config "${legacyPath}" is no longer supported. Create "${configPath}" manually and remove the legacy file.`,
    );
  }

  return {
    projectRoot: resolvedRoot,
    configPath: null,
    exists: false,
    config: createDefaultNamespaceConfig(resolvedRoot),
  };
}

export async function writeNamespaceConfigDocument(document: NamespaceConfigDocument): Promise<string> {
  const configPath = document.configPath ?? join(document.projectRoot, NAMESPACE_CONFIG_FILENAME);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(`${configPath}`, `${JSON.stringify(document.config, null, 2)}\n`, "utf-8");
  return configPath;
}

export function validateNamespaceDocument(document: NamespaceConfigDocument): NamespaceValidateResult {
  const mountDeclarationIssues: NamespaceValidationIssue[] = [];
  const derivedViewPreconditions: NamespaceValidationIssue[] = [];
  const warnings: NamespaceValidationIssue[] = [];
  let schemaValid = true;

  if (document.config.version !== 1) {
    schemaValid = false;
    mountDeclarationIssues.push({
      path: NAMESPACE_CONFIG_FILENAME,
      message: `Namespace config version must be 1, received ${String(document.config.version)}.`,
    });
  }

  if (!Array.isArray(document.config.mounts)) {
    schemaValid = false;
    mountDeclarationIssues.push({
      path: "mounts",
      message: "Namespace config must declare mounts as an array.",
    });
  }

  const seenPaths = new Set<string>();
  const normalizedMounts = Array.isArray(document.config.mounts) ? document.config.mounts : [];
  for (let index = 0; index < normalizedMounts.length; index += 1) {
    const mount = normalizedMounts[index];
    const mountPath = `mounts[${index}]`;
    if (!isMountDeclarationLike(mount)) {
      schemaValid = false;
      mountDeclarationIssues.push({
        path: mountPath,
        message: "Each mount must declare a filesystem type and mount path.",
      });
      continue;
    }

    const normalizedPath = normalizeVfsPath(mount.path);
    if (normalizedPath === "/") {
      mountDeclarationIssues.push({
        path: `${mountPath}.path`,
        message: 'The namespace root "/" is reserved for the implicit root mount projection. Declare only direct subpath mounts in actant.namespace.json.',
      });
    }

    if (seenPaths.has(normalizedPath)) {
      mountDeclarationIssues.push({
        path: `${mountPath}.path`,
        message: `Duplicate mount path "${normalizedPath}" is not allowed.`,
      });
    } else {
      seenPaths.add(normalizedPath);
    }

    if (mount.type === "hostfs") {
      const hostPath = typeof mount.options?.["hostPath"] === "string"
        ? mount.options["hostPath"].trim()
        : "";
      if (!hostPath) {
        mountDeclarationIssues.push({
          path: `${mountPath}.options.hostPath`,
          message: "hostfs mounts must declare options.hostPath.",
        });
      } else {
        const resolvedHostPath = resolve(document.projectRoot, hostPath);
        if (!resolvedHostPath.startsWith(document.projectRoot)) {
          mountDeclarationIssues.push({
            path: `${mountPath}.options.hostPath`,
            message: `hostfs hostPath "${hostPath}" escapes the project root.`,
          });
        }
      }
    }

    if (mount.type === "runtimefs" && normalizedPath !== "/agents" && normalizedPath !== "/mcp/runtime") {
      mountDeclarationIssues.push({
        path: `${mountPath}.path`,
        message: 'runtimefs mounts are limited to "/agents" and "/mcp/runtime" in V1.',
      });
    }

  }

  if (!document.exists) {
    schemaValid = false;
    mountDeclarationIssues.push({
      path: NAMESPACE_CONFIG_FILENAME,
      message: `Namespace config file is missing. Run "actant init" or write "${NAMESPACE_CONFIG_FILENAME}" before validating.`,
    });
  }

  return {
    valid: schemaValid && mountDeclarationIssues.length === 0 && derivedViewPreconditions.length === 0,
    schemaValid,
    configPath: document.configPath,
    projectRoot: document.projectRoot,
    mountDeclarationIssues,
    derivedViewPreconditions,
    warnings,
  };
}

export async function addNamespaceMount(
  projectRoot: string,
  declaration: MountDeclaration,
): Promise<NamespaceConfigDocument> {
  const document = await readNamespaceConfigDocument(projectRoot);
  const normalizedDeclaration = normalizeMountDeclaration(declaration);
  document.config.mounts = [
    ...document.config.mounts.filter((mount: MountDeclaration) => normalizeVfsPath(mount.path) !== normalizedDeclaration.path),
    normalizedDeclaration,
  ];
  return document;
}

export async function removeNamespaceMount(
  projectRoot: string,
  mountPath: string,
): Promise<{ document: NamespaceConfigDocument; removed: boolean }> {
  const document = await readNamespaceConfigDocument(projectRoot);
  const normalizedPath = normalizeVfsPath(mountPath);
  const nextMounts = document.config.mounts.filter((mount: MountDeclaration) => normalizeVfsPath(mount.path) !== normalizedPath);
  const removed = nextMounts.length !== document.config.mounts.length;
  document.config.mounts = nextMounts;
  return { document, removed };
}

export function listNamespaceMountDeclarations(
  document: NamespaceConfigDocument,
  registry?: { resolve(path: string): unknown },
  namespaceRoot = "/",
): Array<{
  name?: string;
  path: string;
  filesystemType: MountDeclaration["type"];
  mounted: boolean;
  options?: Record<string, unknown>;
}> {
  return document.config.mounts.map((mount: MountDeclaration) => {
    const normalizedPath = normalizeMountDeclaration(mount).path;
    const effectivePath = joinNamespaceMountPoint(namespaceRoot, normalizedPath);
    return {
      name: mount.name,
      path: normalizedPath,
      filesystemType: mount.type,
      mounted: registry?.resolve(effectivePath) != null,
      options: mount.options,
    };
  });
}

export function resolveConfigHostDirectory(
  projectRoot: string,
  config: ActantNamespaceConfig,
): string | null {
  const configMount = getConfigHostMount(config);
  if (!configMount) {
    return null;
  }

  const hostPath = typeof configMount.options?.["hostPath"] === "string"
    ? configMount.options["hostPath"]
    : null;
  return hostPath ? resolve(projectRoot, hostPath) : null;
}

export function joinNamespaceMountPoint(namespaceRoot: string, mountPath: string): string {
  const normalizedRoot = normalizeVfsPath(namespaceRoot);
  const normalizedMountPath = normalizeVfsPath(mountPath);
  if (normalizedRoot === "/") {
    return normalizedMountPath;
  }
  return normalizedMountPath === "/"
    ? normalizedRoot
    : `${normalizedRoot}${normalizedMountPath}`;
}

function normalizeNamespaceConfig(
  parsed: Partial<ActantNamespaceConfig>,
  projectRoot: string,
): ActantNamespaceConfig {
  const mounts = Array.isArray(parsed.mounts)
    ? parsed.mounts.filter(isMountDeclarationLike).map((mount: MountDeclaration) => normalizeMountDeclaration(mount))
    : [];
  return {
    version: 1,
    name: typeof parsed.name === "string" && parsed.name.length > 0 ? parsed.name : basename(projectRoot),
    description: typeof parsed.description === "string" ? parsed.description : undefined,
    mounts,
    entrypoints: parsed.entrypoints,
    permissions: parsed.permissions,
    children: Array.isArray(parsed.children) ? parsed.children : [],
  };
}

function normalizeMountDeclaration(declaration: MountDeclaration): MountDeclaration {
  return {
    name: typeof declaration.name === "string" && declaration.name.length > 0 ? declaration.name : undefined,
    type: declaration.type,
    path: normalizeVfsPath(declaration.path),
    options: declaration.options == null ? undefined : { ...declaration.options },
  };
}

function getConfigHostMount(config: ActantNamespaceConfig): MountDeclaration | undefined {
  return config.mounts.find((mount: MountDeclaration) => mount.type === "hostfs" && normalizeVfsPath(mount.path) === "/config");
}

function isMountDeclarationLike(value: unknown): value is MountDeclaration {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<MountDeclaration>;
  return (
    (candidate.type === "hostfs" || candidate.type === "runtimefs")
    && typeof candidate.path === "string"
  );
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeVfsPath(input: string): string {
  if (!input.trim()) {
    return "/";
  }

  const normalizedSegments = input
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".");

  const resolvedSegments: string[] = [];
  for (const segment of normalizedSegments) {
    if (segment === "..") {
      resolvedSegments.pop();
      continue;
    }
    resolvedSegments.push(segment);
  }

  return resolvedSegments.length === 0 ? "/" : `/${resolvedSegments.join("/")}`;
}
