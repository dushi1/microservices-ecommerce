import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // All traffic goes through the API gateway (:3000) — the single public entry point.
      "/api": { target: process.env.VITE_API_URL ?? "http://localhost:3000", changeOrigin: true },
    },
  },
});
