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
    include: ["packages/*/src/**/*.endurance.test.ts"],
    testTimeout: 15 * 60 * 1000, // 15 minutes per test
    hookTimeout: 60 * 1000,
  },
});
