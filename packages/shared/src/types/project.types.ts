import type { CatalogConfig } from "./catalog.types";

export interface MountDeclaration {
  name?: string;
  type: "hostfs" | "runtimefs" | "memfs";
  path: string;
  options?: Record<string, unknown>;
}

export interface CatalogDeclaration {
  name: string;
  type: CatalogConfig["type"];
  options: Record<string, unknown>;
}

export interface PermissionSet {
  read?: boolean;
  write?: boolean;
  watch?: boolean;
  stream?: boolean;
}

export interface PermissionRule extends PermissionSet {
  agent: string;
  path: string;
}

export interface PermissionConfig {
  defaults: PermissionSet;
  rules?: PermissionRule[];
}

export interface ChildNamespaceRef {
  name: string;
  namespace: string;
}

export interface ActantNamespaceEntrypoints {
  readFirst?: string[];
  knowledge?: string[];
}

export interface ActantNamespaceConfig {
  version: 1;
  name?: string;
  description?: string;
  mounts: MountDeclaration[];
  catalogs?: CatalogDeclaration[];
  entrypoints?: ActantNamespaceEntrypoints;
  permissions?: PermissionConfig;
  children?: ChildNamespaceRef[];
}
