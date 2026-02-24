import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/acp-bridge.ts"],
  format: ["esm"],
  dts: { entry: { index: "src/index.ts" }, compilerOptions: { composite: false, skipLibCheck: true } },
  clean: true,
  sourcemap: true,
  banner: ({ format: _f }) => ({
    js: "",
  }),
});
