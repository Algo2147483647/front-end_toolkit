import { resolve } from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";

const root = resolve(__dirname, "apps/react");
const projectRoot = __dirname;

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: {
      "@core": resolve(projectRoot, "packages/core/src")
    }
  },
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), projectRoot]
    }
  },
  build: {
    emptyOutDir: true,
    outDir: resolve(projectRoot, "dist/react")
  }
});
