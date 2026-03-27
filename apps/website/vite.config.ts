import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      $lib: path.resolve(import.meta.dirname, "src", "lib"),
      $routes: path.resolve(import.meta.dirname, "src", "routes"),
    },
  },
  server: {
    watch: {
      usePolling: true,
    },
  },
});
