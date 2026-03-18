import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/acp-bridge.ts",
    "src/package-version.ts",
    "src/pi-builder.ts",
    "src/pi-communicator.ts",
    "src/pi-tool-bridge.ts",
  ],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  banner: ({ format: _f }) => ({
    js: "",
  }),
});
