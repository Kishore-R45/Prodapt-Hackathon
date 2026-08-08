import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { copyFile } from "node:fs/promises";

function copyManifestPlugin() {
  return {
    name: "copy-manifest",
    closeBundle: async () => {
      await copyFile(resolve(__dirname, "manifest.json"), resolve(__dirname, "dist", "manifest.json"));
    }
  };
}

export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, "sidebar.html"),
        popup: resolve(__dirname, "popup.html"),
        content: resolve(__dirname, "src/content/content.ts"),
        background: resolve(__dirname, "src/background/service-worker.ts")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  define: {
    __BACKEND_URL__: JSON.stringify(process.env.VITE_BACKEND_URL ?? "http://localhost:8787")
  }
});