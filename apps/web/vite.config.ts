import { execSync } from "node:child_process";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { SCHEMA_HASH } from "../../packages/shared/src/schema-hash";

const BACKGROUND = "#f7f7f6"; // --color-canvas: matches the app surface, no white flash

function readBuildSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

const BUILD_SHA = readBuildSha();
// Set by a release (scripts/release.mjs, release.yml); every other build is "dev".
const APP_VERSION = process.env.VEGA_VERSION || "dev";

function buildStampPlugin(): Plugin {
  return {
    name: "vega-build-stamp",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { name: "vega-version", content: APP_VERSION }, injectTo: "head" },
      { tag: "meta", attrs: { name: "vega-build", content: BUILD_SHA }, injectTo: "head" },
      { tag: "meta", attrs: { name: "vega-schema", content: SCHEMA_HASH }, injectTo: "head" },
    ],
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_SHA__: JSON.stringify(BUILD_SHA),
    __SCHEMA_HASH__: JSON.stringify(SCHEMA_HASH),
  },
  // .env.local lives at the repo root (not the app dir), so read env from there.
  envDir: path.resolve(__dirname, "..", ".."),
  plugins: [
    react(),
    tailwindcss(),
    buildStampPlugin(),
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
        // The rich-editor chunk (TipTap/ProseMirror) exceeds the 2 MiB default;
        // allow precaching larger chunks so the SW build succeeds.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
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
