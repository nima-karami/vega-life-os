import { test } from "@playwright/test";
import { expectRefreshHoldsLayout } from "./helpers/boot-layout";
import { failOnPageErrors } from "./helpers/page-errors";

failOnPageErrors();

test("refreshing Today on a phone never overflows the viewport through the hand-off", async ({
  page,
}) => {
  await expectRefreshHoldsLayout(page, "/");
});

test("refreshing Habits on a phone never overflows the viewport through the hand-off", async ({
  page,
}) => {
  await expectRefreshHoldsLayout(page, "/habits");
});
