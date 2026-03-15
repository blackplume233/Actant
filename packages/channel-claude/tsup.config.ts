import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/bin/test-chat.ts"],
  format: ["esm"],
  dts: { compilerOptions: { composite: false } },
  clean: true,
  sourcemap: true,
});
