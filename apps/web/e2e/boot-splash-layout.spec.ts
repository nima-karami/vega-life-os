import { test } from "@playwright/test";
import { expectRefreshHoldsLayout } from "./helpers/boot-layout";
import { failOnPageErrors } from "./helpers/page-errors";

/** The splash hand-off must never make the document scroll, or a classic scrollbar reflows the page. */

failOnPageErrors();

test("refreshing Today never overflows the viewport through the hand-off", async ({ page }) => {
  await expectRefreshHoldsLayout(page, "/");
});

test("refreshing Habits never overflows the viewport through the hand-off", async ({ page }) => {
  await expectRefreshHoldsLayout(page, "/habits");
});
