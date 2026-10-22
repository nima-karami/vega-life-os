import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SITE_URL = "https://vega-life-os.web.app/";
// Vite's production precedence, highest first; envDir is the repo root.
const ENV_FILES = [".env.production.local", ".env.production", ".env.local", ".env"];
const REQUEST_TIMEOUT_MS = 15_000;

function readEnvFileKey(fileName, key) {
  const filePath = path.join(REPO_ROOT, fileName);
  if (!existsSync(filePath)) return undefined;
  const line = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith(`${key}=`));
  return (
    line
      ?.slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^["']|["']$/g, "") || undefined
  );
}

// A URL read from a file is never printable: the env files are gitignored secrets.
export function resolveApiUrl() {
  for (const key of ["VEGA_API_URL", "VITE_API_URL"]) {
    if (process.env[key]) return { url: process.env[key], source: key, isPrintable: true };
  }
  for (const fileName of ENV_FILES) {
    const url = readEnvFileKey(fileName, "VITE_API_URL");
    if (url) return { url, source: `${fileName} VITE_API_URL`, isPrintable: false };
  }
  return undefined;
}

export async function fetchServerHealth(apiUrl) {
  const healthUrl = `${apiUrl.replace(/\/+$/, "")}/health`;
  const response = await fetch(healthUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`GET /health returned HTTP ${response.status}`);
  return response.json();
}

export async function fetchHostingBuildSha(siteUrl = SITE_URL) {
  const url = new URL(siteUrl);
  url.searchParams.set("release-plan", String(Date.now()));
  const response = await fetch(url, {
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GET ${siteUrl} returned HTTP ${response.status}`);
  const html = await response.text();
  return html.match(/<meta\s+name="vega-build"\s+content="([^"]*)"/)?.[1];
}
