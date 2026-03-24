export declare const STACK_IDS: {
  readonly CONTRACTS: "contracts";
  readonly VFS: "vfs";
  readonly RUNTIME: "runtime";
  readonly SURFACE: "surface";
  readonly CLEANUP: "cleanup";
};

export type StackId = typeof STACK_IDS[keyof typeof STACK_IDS];

export declare const SHARED_PUBLIC_SUBPATHS: readonly string[];

export declare const PACKAGE_PUBLIC_SUBPATHS: Readonly<Record<string, readonly string[]>>;

export declare const PACKAGE_STACKS: Readonly<Record<string, StackId>>;

export declare const STACK_ALLOWED_DEPENDENCIES: Readonly<Record<StackId, readonly StackId[]>>;

export declare function getStackForPackage(packageName: string): StackId | undefined;

export declare function normalizeImportTarget(specifier: string): string;

export declare function isAllowedPublicSubpath(specifier: string): boolean;

export declare function isAllowedDependency(fromPackage: string, toPackage: string): boolean;

export declare function listWorkspacePackages(): string[];
