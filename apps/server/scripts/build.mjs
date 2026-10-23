import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  // Its google-gax loads .proto files relative to its own __dirname, so it must stay in node_modules.
  external: ["firebase-admin"],
  // Bundled CommonJS still calls require(); ESM output has none until we make one.
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  logLevel: "warning",
});
