import { defineConfig } from "tsup";
import { cpSync, mkdirSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { compilerOptions: { composite: false } },
  clean: true,
  sourcemap: true,
  async onSuccess() {
    mkdirSync("dist/client", { recursive: true });
    cpSync("src/client", "dist/client", { recursive: true });
  },
});
