import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@actant/shared/core", replacement: resolve(rootDir, "packages/shared/src/core.ts") },
      { find: "@actant/shared/vfs-contracts", replacement: resolve(rootDir, "packages/shared/src/vfs-contracts.ts") },
      { find: "@actant/shared/runtime-contracts", replacement: resolve(rootDir, "packages/shared/src/runtime-contracts.ts") },
      { find: "@actant/tui/testing", replacement: resolve(rootDir, "packages/tui/src/testing.ts") },
      { find: "@actant/domain-context", replacement: resolve(rootDir, "packages/domain-context/src/index.ts") },
      { find: "@actant/agent-runtime", replacement: resolve(rootDir, "packages/agent-runtime/src/index.ts") },
      { find: "@actant/shared", replacement: resolve(rootDir, "packages/shared/src/index.ts") },
      { find: "@actant/api", replacement: resolve(rootDir, "packages/api/src/index.ts") },
      { find: "@actant/acp", replacement: resolve(rootDir, "packages/acp/src/index.ts") },
      { find: "@actant/channel-claude", replacement: resolve(rootDir, "packages/channel-claude/src/index.ts") },
      { find: "@actant/pi", replacement: resolve(rootDir, "packages/pi/src/index.ts") },
      { find: "@actant/vfs", replacement: resolve(rootDir, "packages/vfs/src/index.ts") },
      { find: "@actant/tui", replacement: resolve(rootDir, "packages/tui/src/index.ts") },
    ],
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
