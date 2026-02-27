import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { compilerOptions: { composite: false } },
  clean: true,
  sourcemap: true,
  onSuccess: async () => {
    cpSync("src/prompts", "dist/prompts", {
      recursive: true,
      filter: (src) => !src.endsWith(".ts"),
    });
  },
});
