import { type BrowserContext, expect, type Page } from "@playwright/test";
import { test } from "./fixtures";

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

const MARKED_WORKER_REPLY = "marked-build";

// The first sw.js is served with a marker that answers a version ping; every later fetch
// is the untouched build, so the browser sees changed bytes and installs it as an update.
async function serveMarkedFirstWorker(context: BrowserContext) {
  let hasServedMarked = false;
  await context.route("**/sw.js", async (route) => {
    if (hasServedMarked) return route.fallback();
    hasServedMarked = true;
    const response = await route.fetch();
    const marker = `;self.addEventListener("message",(event)=>{event.data==="vega-worker-version"&&event.source.postMessage("${MARKED_WORKER_REPLY}")});`;
    await route.fulfill({ response, body: `${await response.text()}${marker}` });
  });
}

async function loadUntilControlled(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(async () => {
    await page.reload({ waitUntil: "networkidle" });
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  }).toPass({ timeout: 30_000 });
}

function readControllerBuild(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const controller = navigator.serviceWorker.controller;
        if (!controller) return resolve("uncontrolled");
        navigator.serviceWorker.addEventListener(
          "message",
          (event) => resolve(String(event.data)),
          {
            once: true,
          },
        );
        controller.postMessage("vega-worker-version");
        setTimeout(() => resolve("unmarked-build"), 1_500);
      }),
  );
}

async function loadFirstVisit(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForFunction(
    async () => (await navigator.serviceWorker.getRegistration())?.active?.state === "activated",
    null,
    { timeout: 20_000 },
  );
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(false);
}

// A first visit (or a hard reload) leaves the page uncontrolled for its whole life in prompt
// mode, so no controllerchange ever reaches it; that was the Reload dead end.
for (const { name, load, markedBefore } of [
  { name: "a controlled page", load: loadUntilControlled, markedBefore: MARKED_WORKER_REPLY },
  { name: "a first-visit page", load: loadFirstVisit, markedBefore: "uncontrolled" },
]) {
  test(`Reload on the update toast moves ${name} onto the new service worker`, async ({
    page,
    context,
  }) => {
    await serveMarkedFirstWorker(context);
    await load(page);
    expect(await readControllerBuild(page)).toBe(markedBefore);

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    const toast = page.getByRole("status").filter({ hasText: "New version available" });
    await expect(toast).toBeVisible({ timeout: 20_000 });

    const reloaded = page.waitForEvent("load", { timeout: 4_000 });
    await toast.getByRole("button", { name: "Reload" }).click();
    await reloaded;

    expect(await readControllerBuild(page)).toBe("unmarked-build");
    await expect(page.getByText("New version available")).toHaveCount(0);
  });
}

test("a visible tab checks for a new service worker, at most once a minute", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const update = ServiceWorkerRegistration.prototype.update;
    ServiceWorkerRegistration.prototype.update = function countedUpdate() {
      const counted = window as unknown as { e2eUpdateCalls?: number };
      counted.e2eUpdateCalls = (counted.e2eUpdateCalls ?? 0) + 1;
      return update.call(this);
    };
  });
  await loadUntilControlled(page);

  const readUpdateCalls = () =>
    page.evaluate(() => (window as unknown as { e2eUpdateCalls?: number }).e2eUpdateCalls ?? 0);
  const showTab = () => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

  await showTab();
  expect(await readUpdateCalls(), "checked again inside the first minute").toBe(0);

  await page.clock.fastForward("01:01");
  await showTab();
  await expect.poll(readUpdateCalls).toBe(1);

  await showTab();
  expect(await readUpdateCalls(), "throttle let a second check through").toBe(1);

  await page.clock.fastForward("01:00:00");
  await expect.poll(readUpdateCalls).toBe(2);
});
