import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  cacheDir: resolve(__dirname, "../../.vite/mcp-server"),
  resolve: {
    alias: {
      "@actant/shared/core": resolve(__dirname, "../shared/src/core.ts"),
      "@actant/api": resolve(__dirname, "../api/src/index.ts"),
      "@actant/vfs": resolve(__dirname, "../vfs/src/index.ts"),
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
