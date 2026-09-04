import { expect, test } from "@playwright/test";

/**
 * PWA install/runtime proof, run against the built preview (port 5179) — the
 * service worker and the injected manifest <link> only exist in a production
 * build, not the dev server the rest of the suite uses.
 *
 * Native install dialogs and iOS Add-to-Home-Screen are NOT automatable and are
 * verified by manual on-device smoke (see the spec's @manual scenarios).
 */
const previewBaseUrl = `http://localhost:${process.env.E2E_PREVIEW_PORT ?? "5179"}`;
test.use({ baseURL: previewBaseUrl });

interface ManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}
interface Manifest {
  id?: string;
  name?: string;
  short_name?: string;
  start_url?: string;
  display?: string;
  theme_color?: string;
  background_color?: string;
  icons?: ManifestIcon[];
}

test("links a valid manifest with required fields and 192/512 + maskable icons", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const href = await page.getAttribute('link[rel="manifest"]', "href");
  expect(href, "no <link rel=manifest>").toBeTruthy();

  const res = await page.request.get(new URL(href as string, page.url()).toString());
  expect(res.status()).toBe(200);
  const manifest = (await res.json()) as Manifest;

  expect(manifest.id).toBe("/");
  expect(manifest.name).toBe("VEGA · Life OS");
  expect(manifest.short_name).toBe("VEGA");
  expect(manifest.start_url).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBeTruthy();
  expect(manifest.background_color).toBeTruthy();

  const icons = manifest.icons ?? [];
  const sizes = icons.map((i) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  expect(icons.some((i) => (i.purpose ?? "").includes("maskable"))).toBe(true);
});

test("every manifest icon URL resolves (HTTP 200)", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const href = await page.getAttribute('link[rel="manifest"]', "href");
  const res = await page.request.get(new URL(href as string, page.url()).toString());
  const manifest = (await res.json()) as Manifest;

  for (const icon of manifest.icons ?? []) {
    const iconRes = await page.request.get(new URL(icon.src, page.url()).toString());
    expect(iconRes.status(), `icon ${icon.src} did not return 200`).toBe(200);
  }
});

test("a service worker registers and controls the page", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const supported = await page.evaluate(() => "serviceWorker" in navigator);
  expect(supported, "service worker unsupported in test browser").toBe(true);

  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return !!(reg?.active || reg?.installing || reg?.waiting);
    },
    null,
    { timeout: 20_000 },
  );

  // Once activated and controlling, navigator.serviceWorker.controller is set.
  // With registerType "prompt" (no skipWaiting/clientsClaim) the controller is
  // only set on a navigation that occurs after activation, so reload until it is.
  await expect(async () => {
    await page.reload({ waitUntil: "networkidle" });
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    expect(controlled).toBe(true);
  }).toPass({ timeout: 30_000 });
  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.scope ?? "";
  });
  expect(scope).toMatch(/\/$/);
});

test("graceful degradation: nothing throws when service workers are unsupported", async ({
  browser,
}) => {
  // Strip the serviceWorker API before any app script runs, then load the app.
  const context = await browser.newContext({ baseURL: previewBaseUrl });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "serviceWorker", { get: () => undefined });
  });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/", { waitUntil: "networkidle" });
  // App still renders its first screen (onboarding/boot or shell), no fatal throw.
  await expect(page.locator("#root")).not.toBeEmpty({ timeout: 15_000 });
  expect(errors, `runtime errors:\n${errors.join("\n")}`).toEqual([]);

  await context.close();
});
