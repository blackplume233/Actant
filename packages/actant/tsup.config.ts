import { defineConfig } from "tsup";
import { copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core.ts",
    "src/shared.ts",
    "src/acp.ts",
    "src/mcp.ts",
    "src/pi.ts",
    "src/cli.ts",
  ],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  external: [/^@actant\//],
  onSuccess: async () => {
    const srcDir = join(import.meta.dirname, "src");
    const distDir = join(import.meta.dirname, "dist");
    for (const f of readdirSync(srcDir)) {
      if (f.endsWith(".ts")) {
        copyFileSync(join(srcDir, f), join(distDir, f.replace(".ts", ".d.ts")));
      }
    }
  },
});
