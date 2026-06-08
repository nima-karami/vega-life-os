import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    // ensure a single React instance across all deps (fixes "invalid hook call")
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5180,
    strictPort: false,
  },
  optimizeDeps: {
    // only scan the real entry — keep the design-handoff HTML out of the graph
    entries: ["index.html"],
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  },
});
