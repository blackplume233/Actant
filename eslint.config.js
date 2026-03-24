import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { PACKAGE_STACKS, STACK_IDS } from "./configs/stack-boundaries.mjs";

function packageGlob(packageNames) {
  const dirs = packageNames.map((name) => (name === "actant" ? "actant" : name.replace("@actant/", "")));
  return dirs.flatMap((dir) => [`packages/${dir}/src/**/*.ts`, `packages/${dir}/src/**/*.tsx`]);
}

const runtimePackages = Object.entries(PACKAGE_STACKS)
  .filter(([, stack]) => stack === STACK_IDS.RUNTIME)
  .map(([name]) => name);
const surfacePackages = Object.entries(PACKAGE_STACKS)
  .filter(([, stack]) => stack === STACK_IDS.SURFACE)
  .map(([name]) => name);

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-console": ["error", { allow: ["error"] }],
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "@actant/shared",
            message: "Use explicit @actant/shared subpaths.",
          },
          {
            name: "@actant/context",
            message: "@actant/context is a cleanup target and must not be imported.",
          },
        ],
        patterns: [
          {
            group: ["@actant/*/src/*"],
            message: "Do not import package src internals across workspace packages.",
          },
        ],
      }],
    },
  },
  {
    files: packageGlob(["@actant/vfs"]),
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          ...runtimePackages.map((name) => ({
            name,
            message: "VFS stack may not depend on AgentRuntime stack packages.",
          })),
          ...surfacePackages.map((name) => ({
            name,
            message: "VFS stack may not depend on Surface stack packages.",
          })),
          {
            name: "@actant/shared",
            message: "Use explicit @actant/shared subpaths.",
          },
          {
            name: "@actant/context",
            message: "@actant/context is a cleanup target and must not be imported.",
          },
        ],
        patterns: [
          {
            group: ["@actant/*/src/*"],
            message: "Do not import package src internals across workspace packages.",
          },
        ],
      }],
    },
  },
  {
    files: packageGlob(runtimePackages),
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          ...surfacePackages.map((name) => ({
            name,
            message: "AgentRuntime stack may not depend on Surface stack packages.",
          })),
          {
            name: "@actant/shared",
            message: "Use explicit @actant/shared subpaths.",
          },
          {
            name: "@actant/context",
            message: "@actant/context is a cleanup target and must not be imported.",
          },
        ],
        patterns: [
          {
            group: ["@actant/*/src/*"],
            message: "Do not import package src internals across workspace packages.",
          },
        ],
      }],
    },
  },
  {
    files: ["packages/*/src/**/*.test.ts", "packages/*/src/**/*.test.tsx"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["packages/cli/src/**/*.ts", "packages/cli/src/**/*.tsx"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/dist-standalone/**",
      "**/node_modules/**",
      "trash/**",
      "**/*.config.ts",
      "**/*.config.js",
      ".agents/**",
      ".claude/worktrees/**",
      ".trellis/**",
      ".actant-dev-cache/**",
      ".actant-smoke/**",
      ".vite/**",
      "scripts/**",
      "packages/*/scripts/**",
      "docs/site/**",
    ],
  },
);
