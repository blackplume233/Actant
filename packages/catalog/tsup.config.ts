import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["@actant/shared", "@actant/domain-context", "zod", "zod/v4", "picomatch"],
});
