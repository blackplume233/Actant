import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@actant/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@actant/shared": resolve(__dirname, "packages/shared/src/index.ts"),
      "@actant/api": resolve(__dirname, "packages/api/src/index.ts"),
    },
  },
  test: {
    globals: true,
    passWithNoTests: true,
    include: ["packages/*/src/**/*.test.ts"],
    exclude: ["packages/*/src/**/*.endurance.test.ts"],
    coverage: {
      include: ["packages/*/src/**/*.ts"],
      exclude: ["packages/*/src/**/*.test.ts", "packages/*/src/**/index.ts"],
    },
  },
});
