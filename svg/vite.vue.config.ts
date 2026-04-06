import { resolve } from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import vue from "@vitejs/plugin-vue";

const root = resolve(__dirname, "apps/vue");
const projectRoot = __dirname;

export default defineConfig({
  root,
  plugins: [vue()],
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
    outDir: resolve(projectRoot, "dist/vue")
  }
});
