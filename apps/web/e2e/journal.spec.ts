import { expect, test } from "@playwright/test";

/**
 * Full-screen journal editor (Notion-style) E2E. Drives the real app: the
 * /journal/:date page, the slash command menu, persistence across reload,
 * plain-text back-compat, and gratitude wrapping.
 */

const IGNORE = [/Download the React DevTools/i, /\[vite\]/i, /Firebase/i];

async function bootSandbox(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test.beforeEach(async ({ page }) => {
  await bootSandbox(page);
});

test("journal: opens as a full-screen page with a focused editor", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) {
      errors.push(`console.error: ${m.text()}`);
    }
  });

  await page.goto(`/journal/${todayISO()}`, { waitUntil: "networkidle" });
  // It's a page, not a modal.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Journal" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("journal: slash menu inserts a to-do and it persists across reload", async ({ page }) => {
  const date = todayISO();
  await page.goto(`/journal/${date}`, { waitUntil: "networkidle" });

  const editor = page.getByRole("textbox", { name: "Journal" });
  await editor.click();
  await editor.pressSequentially("My day ");

  // "/" at a word boundary opens the slash menu.
  await editor.pressSequentially("/");
  const menu = page.getByRole("listbox", { name: "Insert block" });
  await expect(menu).toBeVisible();

  // Filter to the to-do command and choose it.
  await editor.pressSequentially("todo");
  await page.getByRole("option", { name: /To-do list/ }).click();
  await editor.pressSequentially("buy milk");

  // The checkbox item rendered.
  const taskList = page.locator('ul[data-type="taskList"]');
  await expect(taskList.locator('input[type="checkbox"]')).toHaveCount(1);
  await expect(taskList.locator("p", { hasText: "buy milk" })).toBeVisible();

  // Wait past the autosave debounce, reload, and confirm it persisted.
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });
  await expect(taskList.locator('input[type="checkbox"]')).toHaveCount(1);
  await expect(taskList.locator("p", { hasText: "buy milk" })).toBeVisible();
});

test("journal: slash menu does NOT open mid-word (http://)", async ({ page }) => {
  await page.goto(`/journal/${todayISO()}`, { waitUntil: "networkidle" });
  const editor = page.getByRole("textbox", { name: "Journal" });
  await editor.click();
  await editor.pressSequentially("see http:/");
  // The "/" right after "http:" is mid-word — no slash menu.
  await expect(page.getByRole("listbox", { name: "Insert block" })).toBeHidden();
});

test("journal: a long gratitude entry wraps and stays fully visible", async ({ page }) => {
  await page.goto(`/journal/${todayISO()}`, { waitUntil: "networkidle" });
  const field = page.getByRole("textbox", { name: "Grateful for, item 1" });
  await field.click();
  const oneLine = (await field.boundingBox())?.height ?? 0;

  const long =
    "I am grateful for a long, multi-sentence reflection that should wrap onto several lines and grow the field rather than being clipped to a single line, staying fully visible.";
  await field.fill(long);
  // The multiline textarea grows past its single-line height (no truncation).
  await expect
    .poll(async () => (await field.boundingBox())?.height ?? 0)
    .toBeGreaterThan(oneLine + 15);
  await expect(field).toHaveValue(long);
});

test("journal: plain-text entry renders and stays editable (back-compat)", async ({ page }) => {
  const date = todayISO();
  await page.goto(`/journal/${date}`, { waitUntil: "networkidle" });

  const editor = page.getByRole("textbox", { name: "Journal" });
  await editor.click();
  await editor.pressSequentially("just a plain note");
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });

  // Renders as a paragraph and remains editable.
  await expect(page.getByText("just a plain note")).toBeVisible();
  const reopened = page.getByRole("textbox", { name: "Journal" });
  await reopened.click();
  await reopened.pressSequentially(" — extended");
  await expect(reopened).toContainText("just a plain note — extended");
});

test("journal: an invalid date param redirects to today", async ({ page }) => {
  await page.goto("/journal/not-a-date", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/(today)?$/);
});
