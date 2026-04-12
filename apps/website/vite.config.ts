import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import { pages } from "../../packages/router/src/vite";

export default defineConfig({
  plugins: [pages(), tailwindcss()],
  resolve: {
    alias: {
      $lib: path.resolve(import.meta.dirname, "src", "lib"),
      $routes: path.resolve(import.meta.dirname, "src", "routes"),
      ilha: path.resolve(import.meta.dirname, "..", "..", "packages", "ilha", "src", "index.ts"),
      "@ilha/router": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "packages",
        "router",
        "src",
        "index.ts",
      ),
    },
  },
  server: {
    watch: {
      usePolling: true,
    },
  },
});
