import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/bin/actant.ts", "src/daemon-entry.ts"],
  format: ["esm"],
  dts: { compilerOptions: { composite: false } },
  clean: true,
  sourcemap: true,
});
