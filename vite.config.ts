import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const BACKGROUND = "#f7f7f6"; // --color-canvas: matches the app surface, no white flash

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["vega.svg", "apple-touch-icon-180.png"],
      manifest: {
        id: "/",
        name: "VEGA · Life OS",
        short_name: "VEGA",
        description: "Your local-first life command center: Values → Goals → Habits → Tasks.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: BACKGROUND,
        background_color: BACKGROUND,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/sw\.js$/, /^\/manifest\.webmanifest$/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
