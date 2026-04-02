import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [nitro()],
  nitro: {
    serverDir: "./src",
  },
});
