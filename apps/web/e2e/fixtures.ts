import { test as base } from "@playwright/test";

/**
 * Every spec runs against a page with the index.html boot splash removed before it paints,
 * so no load pays the tagline dwell and no early click lands on the splash. The splash
 * itself is proven in boot-splash.spec.ts, which imports the stock `test` instead.
 */
export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.addInitScript(() => {
      new MutationObserver((_, observer) => {
        const splash = document.getElementById("boot");
        if (!splash) return;
        splash.remove();
        observer.disconnect();
      }).observe(document, { childList: true, subtree: true });
    });
    await provide(context);
  },
});
