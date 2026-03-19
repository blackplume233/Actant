import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@actant/domain-context": resolve(rootDir, "packages/domain-context/src/index.ts"),
      "@actant/source": resolve(rootDir, "packages/source/src/index.ts"),
      "@actant/agent-runtime": resolve(rootDir, "packages/agent-runtime/src/index.ts"),
      "@actant/shared": resolve(rootDir, "packages/shared/src/index.ts"),
      "@actant/api": resolve(rootDir, "packages/api/src/index.ts"),
      "@actant/acp": resolve(rootDir, "packages/acp/src/index.ts"),
      "@actant/channel-claude": resolve(rootDir, "packages/channel-claude/src/index.ts"),
      "@actant/pi": resolve(rootDir, "packages/pi/src/index.ts"),
      "@actant/context": resolve(rootDir, "packages/context/src/index.ts"),
      "@actant/vfs": resolve(rootDir, "packages/vfs/src/index.ts"),
      "@actant/tui": resolve(rootDir, "packages/tui/src/index.ts"),
      "@actant/tui/testing": resolve(rootDir, "packages/tui/src/testing.ts"),
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
