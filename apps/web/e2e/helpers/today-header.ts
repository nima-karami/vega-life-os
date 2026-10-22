import { expect, type Page } from "@playwright/test";

/** The journal pill sits in the Today header's h1 row: above Remaining, centred on the h1,
 *  right edge flush with the date nav. */
export async function expectJournalButtonInHeader(page: Page, label: "Journal" | "Edit entry") {
  const header = page.locator("main header");
  const button = header.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible({ timeout: 15_000 });

  const [buttonBox, headingBox, nextDayBox, remainingBox] = await Promise.all([
    button.boundingBox(),
    header.getByRole("heading", { level: 1 }).boundingBox(),
    header.getByRole("button", { name: "Next day" }).boundingBox(),
    page.getByRole("region", { name: "Remaining" }).boundingBox(),
  ]);
  if (!buttonBox || !headingBox || !nextDayBox || !remainingBox) {
    throw new Error("a Today header element has no layout box");
  }

  expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(remainingBox.y);
  const centreOf = (box: { y: number; height: number }) => box.y + box.height / 2;
  expect(Math.abs(centreOf(buttonBox) - centreOf(headingBox))).toBeLessThanOrEqual(1);
  expect(
    Math.abs(buttonBox.x + buttonBox.width - (nextDayBox.x + nextDayBox.width)),
  ).toBeLessThanOrEqual(1);
}
