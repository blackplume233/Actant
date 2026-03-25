export const STACK_IDS = {
  CONTRACTS: "contracts",
  VFS: "vfs",
  RUNTIME: "runtime",
  SURFACE: "surface",
  CLEANUP: "cleanup",
};

export const SHARED_PUBLIC_SUBPATHS = [
  "@actant/shared/vfs-contracts",
];

export const PACKAGE_PUBLIC_SUBPATHS = {
  "@actant/shared": SHARED_PUBLIC_SUBPATHS,
  "@actant/tui": ["@actant/tui/testing"],
  "@actant/cli": [
    "@actant/cli/dist/bin/actant.js",
    "@actant/cli/dist/bin/acthub.js",
  ],
};

export const PACKAGE_STACKS = {
  "@actant/shared": STACK_IDS.CONTRACTS,
  "@actant/vfs": STACK_IDS.VFS,
  "@actant/agent-runtime": STACK_IDS.RUNTIME,
  "@actant/domain-context": STACK_IDS.RUNTIME,
  "@actant/acp": STACK_IDS.RUNTIME,
  "@actant/pi": STACK_IDS.RUNTIME,
  "@actant/channel-claude": STACK_IDS.RUNTIME,
  "@actant/tui": STACK_IDS.RUNTIME,
  "@actant/api": STACK_IDS.SURFACE,
  "@actant/cli": STACK_IDS.SURFACE,
  "@actant/mcp-server": STACK_IDS.SURFACE,
  "@actant/rest-api": STACK_IDS.SURFACE,
  "@actant/dashboard": STACK_IDS.SURFACE,
  "actant": STACK_IDS.SURFACE,
  "@actant/context": STACK_IDS.CLEANUP,
};

export const STACK_ALLOWED_DEPENDENCIES = {
  [STACK_IDS.CONTRACTS]: [STACK_IDS.CONTRACTS],
  [STACK_IDS.VFS]: [STACK_IDS.CONTRACTS, STACK_IDS.VFS],
  [STACK_IDS.RUNTIME]: [STACK_IDS.CONTRACTS, STACK_IDS.VFS, STACK_IDS.RUNTIME],
  [STACK_IDS.SURFACE]: [STACK_IDS.CONTRACTS, STACK_IDS.VFS, STACK_IDS.RUNTIME, STACK_IDS.SURFACE],
  [STACK_IDS.CLEANUP]: [],
};

export function getStackForPackage(packageName) {
  return PACKAGE_STACKS[packageName];
}

export function normalizeImportTarget(specifier) {
  if (PACKAGE_STACKS[specifier]) {
    return specifier;
  }
  if (specifier.startsWith("@actant/shared/")) {
    return "@actant/shared";
  }
  if (specifier.startsWith("@actant/")) {
    const parts = specifier.split("/");
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  }
  if (specifier.startsWith("actant/")) {
    return "actant";
  }
  return specifier;
}

export function isAllowedPublicSubpath(specifier) {
  const owner = normalizeImportTarget(specifier);
  const allowedSubpaths = PACKAGE_PUBLIC_SUBPATHS[owner];
  return Array.isArray(allowedSubpaths) && allowedSubpaths.includes(specifier);
}

export function isAllowedDependency(fromPackage, toPackage) {
  const fromStack = getStackForPackage(fromPackage);
  const toStack = getStackForPackage(toPackage);
  if (!fromStack || !toStack) {
    return false;
  }
  if (toStack === STACK_IDS.CLEANUP) {
    return false;
  }
  return STACK_ALLOWED_DEPENDENCIES[fromStack].includes(toStack);
}

export function listWorkspacePackages() {
  return Object.keys(PACKAGE_STACKS).filter((name) => getStackForPackage(name) !== STACK_IDS.CLEANUP);
}
