import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@actant/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@actant/shared": resolve(__dirname, "packages/shared/src/index.ts"),
      "@actant/api": resolve(__dirname, "packages/api/src/index.ts"),
      "@actant/acp": resolve(__dirname, "packages/acp/src/index.ts"),
      "@actant/channel-claude": resolve(__dirname, "packages/channel-claude/src/index.ts"),
      "@actant/pi": resolve(__dirname, "packages/pi/src/index.ts"),
      "@actant/vfs": resolve(__dirname, "packages/vfs/src/index.ts"),
      "@actant/tui": resolve(__dirname, "packages/tui/src/index.ts"),
      "@actant/tui/testing": resolve(__dirname, "packages/tui/src/testing.ts"),
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
