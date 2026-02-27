import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const clientDir = path.resolve(__dirname);

export default defineConfig({
  root: clientDir,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(clientDir, "src"),
    },
  },
  build: {
    outDir: path.resolve(clientDir, "../dist/client"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/v1": "http://localhost:3200",
      "/sse": "http://localhost:3200",
      "/api": "http://localhost:3200",
    },
  },
});
