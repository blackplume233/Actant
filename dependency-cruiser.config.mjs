import { PACKAGE_STACKS, STACK_IDS } from "./configs/stack-boundaries.mjs";

function packageDirPattern(stackId) {
  const names = Object.entries(PACKAGE_STACKS)
    .filter(([, stack]) => stack === stackId)
    .map(([pkg]) => escapeRegex(packageDirName(pkg)));
  return names.length > 0 ? `^packages\\/(${names.join("|")})\\/src\\/` : "^$";
}

function packageDirName(packageName) {
  if (packageName === "actant") {
    return "actant";
  }
  return packageName.replace(/^@actant\//, "");
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

const vfsPattern = packageDirPattern(STACK_IDS.VFS);
const runtimePattern = packageDirPattern(STACK_IDS.RUNTIME);
const surfacePattern = packageDirPattern(STACK_IDS.SURFACE);
const cleanupPattern = packageDirPattern(STACK_IDS.CLEANUP);

export default {
  options: {
    tsConfig: {
      fileName: "tsconfig.base.json",
    },
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "(^|/)(dist|node_modules|trash|\\.trellis|docs/site)/",
    },
  },
  forbidden: [
    {
      name: "no-vfs-to-runtime",
      severity: "error",
      comment: "VFS stack must stay isolated from runtime stack imports.",
      from: { path: vfsPattern },
      to: { path: runtimePattern },
    },
    {
      name: "no-vfs-to-surface",
      severity: "error",
      comment: "VFS stack must not depend on surface stack packages.",
      from: { path: vfsPattern },
      to: { path: surfacePattern },
    },
    {
      name: "no-runtime-to-surface",
      severity: "error",
      comment: "Runtime stack must not depend on surface stack packages.",
      from: { path: runtimePattern },
      to: { path: surfacePattern },
    },
    {
      name: "no-deps-on-cleanup-target",
      severity: "error",
      comment: "Cleanup-target packages must have no incoming dependencies.",
      from: { path: "^(?!packages\\/context\\/src\\/).*" },
      to: { path: cleanupPattern },
    },
    {
      name: "no-shared-root-imports",
      severity: "error",
      comment: "Workspace packages must use explicit shared subpaths.",
      from: {
        path: "^packages\\/",
        pathNot: "^packages\\/shared\\/src\\/(core|vfs-contracts|runtime-contracts)\\.ts$",
      },
      to: {
        dependencyTypes: ["local", "localmodule", "aliased", "npm-no-pkg"],
        path: "^packages\\/shared\\/src\\/index\\.ts$",
      },
    },
  ],
};
