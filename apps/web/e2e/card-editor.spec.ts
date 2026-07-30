import { expect, type Page, test } from "@playwright/test";

/**
 * Two regressions for the card editor.
 *
 * 1. A browser extension's popup used to close the editor and discard the draft.
 *    React Aria marks every element injected into the page while a modal is open
 *    `inert`, so the popup takes no pointer events and the click falls through to
 *    the backdrop underneath — which used to dismiss the modal.
 * 2. Preview must render the real feed face (and its back), not the raw markdown.
 */

async function openNewCardEditor(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }

  // The sandbox re-gates on a gratitude entry each day; it blocks every other route.
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
    await expect(gate).toBeHidden();
  }

  await page.goto("/scroll/manage", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "New card" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** Mirrors how Grammarly injects UI: a custom element on <body> with an open shadow root. */
async function injectExtensionPopupOverBackdrop(page: Page) {
  await page.evaluate(() => {
    const host = document.createElement("grammarly-extension");
    host.style.cssText = "position:fixed;left:80px;top:300px;z-index:2147483647;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = '<div style="width:240px;height:70px;background:#22c55e"></div>';
    document.body.appendChild(host);
  });
  // React Aria's MutationObserver marks it inert asynchronously.
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector("grammarly-extension")?.hasAttribute("inert")),
    )
    .toBe(true);
}

test("an extension popup's click cannot close the editor or discard the draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openNewCardEditor(page);

  const dialog = page.getByRole("dialog");
  const title = page.getByRole("textbox", { name: "Card title" });
  await title.fill("Draft worth keeping");

  await injectExtensionPopupOverBackdrop(page);

  // The popup is inert, so this lands on the backdrop — exactly the reported gesture.
  const hitTarget = await page.evaluate(() =>
    document.elementFromPoint(200, 335)?.getAttribute("data-slot"),
  );
  expect(hitTarget, "the click must fall through onto the backdrop").toBe("modal-backdrop");

  await page.mouse.click(200, 335);

  await expect(dialog, "outside click must not close an editor").toBeVisible();
  await expect(title).toHaveValue("Draft worth keeping");

  // Pressing the scrim must not blur the dialog — React Aria scopes Escape to the
  // overlay, so focus on <body> would strand a modal that no longer closes on click.
  const isFocusInsideDialog = await page.evaluate(
    () => !!document.activeElement?.closest('[role="dialog"]'),
  );
  expect(isFocusInsideDialog, "focus must stay inside the dialog").toBe(true);

  // Escape is still the deliberate way out.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("preview renders the card's real face and flips to its back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openNewCardEditor(page);

  const dialog = page.getByRole("dialog");
  await page.getByRole("textbox", { name: "Card title" }).fill("Second-order thinking");
  await page.getByRole("textbox", { name: "Card body" }).click();
  await page.keyboard.type("Ask and then what?");

  await dialog.getByRole("button", { name: "Preview", exact: true }).click();

  const preview = dialog.locator("[data-card-preview]");
  await expect(preview).toBeVisible();
  await expect(preview, "front shows the title").toContainText("Second-order thinking");
  await expect(dialog.getByRole("textbox", { name: "Card body" })).toBeHidden();

  await dialog.getByRole("button", { name: /the back of the card/ }).click();
  await expect(preview, "back shows the body").toContainText("Ask and then what?");

  // Returning to the form keeps everything the draft had.
  await dialog.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "Card body" })).toContainText(
    "Ask and then what?",
  );
});
