import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

export default defineConfig({
  base: "./",

  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString())
  },

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  },

  build: {
    chunkSizeWarningLimit: 2500
  }
});