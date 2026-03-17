import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
  version: string;
};

export default defineConfig({
  entry: ["src/index.ts", "src/bin/actant.ts", "src/bin/acthub.ts", "src/daemon-entry.ts"],
  format: ["esm"],
  dts: { compilerOptions: { composite: false } },
  clean: true,
  sourcemap: true,
  define: {
    __ACTANT_CLI_VERSION__: JSON.stringify(version),
  },
});
