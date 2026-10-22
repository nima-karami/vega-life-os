import { expect, type Locator, type Page, test } from "@playwright/test";
import { format, setDate, subMonths } from "date-fns";
import { enterApp } from "./helpers/app";
import { clearFinanceStores } from "./helpers/finance";

/**
 * The five finance grids drop their fixed columns for stacked rows on a phone. The desktop specs
 * run at 1280 in the chromium project and never reach that branch; the `.mobile.spec.ts` suffix
 * routes this file into the Pixel 7 project instead.
 */

const PHONE = { width: 390, height: 844 };

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** The seed's partner-paid grocery run sits three days back — derived, never a pinned month. */
function partnerHeavyMonth(): string {
  const date = new Date();
  date.setDate(date.getDate() - 3);
  return monthKey(date);
}

/**
 * The settled month is the only one whose household rows are offsets from its own start, so it
 * always holds two owner-paid rows and one partner-paid one — the mix a payer filter needs.
 */
const settledMonth = (): string => monthKey(subMonths(new Date(), 2));

const STATEMENT_ANCHOR = subMonths(new Date(), 1);
const onDay = (day: number) => format(setDate(STATEMENT_ANCHOR, day), "MM/dd/yyyy");

const STATEMENT = [
  "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$",
  `Chequing,1234,${onDay(3)},,E2E PHONE COFFEE,,-12.50`,
  `Chequing,1234,${onDay(4)},,E2E PHONE BOOKS,,-31.00`,
].join("\n");

async function openPhone(page: Page, route: string) {
  await enterApp(page);
  await page.setViewportSize(PHONE);
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
}

// The view strip is left out on purpose: it is deliberately scrollable and bleeds into the shell.
// An ellipsised run is excused: inline text in a `truncate` keeps its whole font-dependent run as its box.
async function tooWideInside(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (root === null) return [`nothing matched ${sel}`];
    const strip = document.querySelector('nav[aria-label="Finance views"]');
    const limit = document.documentElement.clientWidth + 1;

    const paintedWidth = (element: Element) => {
      const box = element.getBoundingClientRect();
      const ellipsis = element.parentElement?.closest(".truncate") ?? null;
      if (ellipsis === null) return box.width;
      const bounds = ellipsis.getBoundingClientRect();
      return Math.max(0, Math.min(box.right, bounds.right) - Math.max(box.left, bounds.left));
    };

    const wide: string[] = [];
    for (const element of root.querySelectorAll("*")) {
      if (strip !== null && (element.contains(strip) || strip.contains(element))) continue;
      if (paintedWidth(element) > limit) {
        wide.push(`${element.tagName}[${element.getAttribute("class") ?? ""}]`);
      }
    }
    return wide;
  }, selector);
}

const region = (page: Page, name: string) => page.getByRole("region", { name });

/** The narrowest phone still supported — where the meta run has the least room to give. */
const NARROW = { width: 320, height: 800 };

const TOUCH_MINIMUM = 44;

interface BudgetChipPlacement {
  label: string;
  overprints: string | null;
  clippedBy: string | null;
  startsBelowAmount: boolean;
  width: number;
}

/**
 * Rects, not `documentElement.scrollWidth`: every call site measures the chip at rest, and a
 * resting chip can paint over the spent figure, or be cut short by an ancestor, without widening
 * the page at all. The positive half is measured too — a chip clipped to nothing also stops
 * overlapping.
 */
async function measureBudgetChips(page: Page): Promise<BudgetChipPlacement[]> {
  return page.evaluate(() => {
    const describe = (node: Element) => `${node.tagName}[${node.getAttribute("class") ?? ""}]`;

    const findAmount = (chip: Element): Element | null => {
      for (let node = chip.parentElement; node !== null; node = node.parentElement) {
        const amount = node.querySelector('[data-testid="compact-amount"]');
        if (amount !== null) return amount;
      }
      return null;
    };

    const isCutHorizontally = (box: DOMRect, node: Element) => {
      const style = getComputedStyle(node);
      if (style.overflowX === "visible" && style.overflowY === "visible") return false;
      const bounds = node.getBoundingClientRect();
      return box.left < bounds.left - 0.5 || box.right > bounds.right + 0.5;
    };

    const findClippingAncestor = (chip: Element, box: DOMRect): string | null => {
      for (let node = chip.parentElement; node !== null; node = node.parentElement) {
        if (isCutHorizontally(box, node)) return describe(node);
      }
      return null;
    };

    const intersects = (box: DOMRect, other: DOMRect) =>
      Math.min(box.right, other.right) - Math.max(box.left, other.left) > 0 &&
      Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 0;

    return Array.from(document.querySelectorAll('[aria-label^="Monthly budget for"]')).map(
      (chip) => {
        const box = chip.getBoundingClientRect();
        const amount = findAmount(chip);
        const amountBox = amount?.getBoundingClientRect() ?? null;

        return {
          label: chip.getAttribute("aria-label") ?? "",
          overprints:
            amountBox !== null && intersects(box, amountBox)
              ? `over ${amount?.textContent ?? ""}`
              : null,
          clippedBy: findClippingAncestor(chip, box),
          startsBelowAmount: amountBox !== null && box.top >= amountBox.bottom - 0.5,
          width: box.width,
        };
      },
    );
  });
}

async function expectChipsClearOfAmounts(page: Page, where: string) {
  const chips = await measureBudgetChips(page);

  expect(chips.length, `${where}: no budget chip was measured`).toBeGreaterThan(0);
  expect(
    chips.filter((chip) => chip.overprints !== null),
    `${where}: a chip paints over the figure it is judged against`,
  ).toEqual([]);
  expect(
    chips.filter((chip) => !chip.startsBelowAmount),
    `${where}: a chip does not start below the amount cell`,
  ).toEqual([]);
  expect(
    chips.filter((chip) => chip.clippedBy !== null),
    `${where}: a chip is cut short rather than taking its own line`,
  ).toEqual([]);
  expect(
    chips.filter((chip) => chip.width < TOUCH_MINIMUM),
    `${where}: a chip is under the ${TOUCH_MINIMUM}px minimum`,
  ).toEqual([]);
}

async function expectThumbSized(target: Locator, label: string) {
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box?.height ?? 0, `${label} is under the 44px phone minimum`).toBeGreaterThanOrEqual(
    TOUCH_MINIMUM,
  );
  expect(
    box?.width ?? 0,
    `${label} is narrower than the 44px phone minimum`,
  ).toBeGreaterThanOrEqual(TOUCH_MINIMUM);
}

test("the category table stacks, and every row action survives the drop", async ({ page }) => {
  await openPhone(page, "/finance/categories");
  await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // Software carries the annual licence, recognised in every month, so it is the one row the seed
  // guarantees regardless of today's date.
  const row = page.getByRole("link", { name: /^Software\b/ }).first();
  await expect(row).toContainText("1 row");
  await expect(page.getByRole("button", { name: "Monthly budget for Software" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actions for Software" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Software" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Software pace" })).toBeVisible();

  expect(await tooWideInside(page, "main")).toEqual([]);
});

test("the budget chip never paints over the figure it is judged against", async ({ page }) => {
  await openPhone(page, "/finance/categories");
  await expect(page.getByRole("button", { name: "Monthly budget for Software" })).toBeVisible({
    timeout: 15_000,
  });
  await expectChipsClearOfAmounts(page, "at 390");

  await page.setViewportSize(NARROW);
  await expect(page.getByRole("button", { name: "Monthly budget for Home & rent" })).toBeVisible();

  await expectChipsClearOfAmounts(page, "at 320");
});

/** Long enough that a title sharing its line with an amount and two 44px targets is useless. */
const LONG_CATEGORY = "Subscriptions and memberships";

/** The title against the row's own content box — the row never overflowed, it starved the name. */
async function measureRowTitle(page: Page, name: string) {
  return page.evaluate((wanted) => {
    const title = Array.from(document.querySelectorAll("span")).find(
      (node) =>
        node.className.includes("truncate") &&
        (node.textContent ?? "").startsWith(wanted.slice(0, 8)),
    );
    if (title === undefined) return { shown: 0, available: 0, swatchRun: 0, text: "" };

    // Read rather than hardcoded: the swatch and its gap are all the title may give up, and a
    // restyled swatch must not redden this for a reason that has nothing to do with the defect.
    const titleRow = title.parentElement;
    const swatch = titleRow?.querySelector("[aria-hidden]") ?? null;
    const swatchRun =
      swatch === null || titleRow === null
        ? 0
        : swatch.getBoundingClientRect().width +
          Number.parseFloat(getComputedStyle(titleRow).columnGap);

    let row = title.parentElement;
    while (row !== null && !(row.className || "").includes("py-2.5")) row = row.parentElement;
    if (row === null)
      return { shown: title.clientWidth, available: 0, swatchRun, text: title.textContent ?? "" };

    const padding = getComputedStyle(row);
    const available =
      row.clientWidth -
      Number.parseFloat(padding.paddingLeft) -
      Number.parseFloat(padding.paddingRight);
    return { shown: title.clientWidth, available, swatchRun, text: title.textContent ?? "" };
  }, name);
}

test("a long category name gets the width the row actually has", async ({ page }) => {
  await openPhone(page, "/finance/categories");
  await page.getByRole("button", { name: "Actions for Software" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Category name" }).fill(LONG_CATEGORY);
  await page.getByRole("button", { name: "Save" }).click();

  await page.setViewportSize(NARROW);
  await expect(page.getByRole("link", { name: LONG_CATEGORY }).first()).toBeVisible();

  const title = await measureRowTitle(page, LONG_CATEGORY);
  expect(title.text, "no title span carried the category name").toContain(LONG_CATEGORY);
  expect(title.available, "the row it sits in was never found").toBeGreaterThan(0);
  expect(
    title.swatchRun,
    "the colour swatch the title makes room for was never found",
  ).toBeGreaterThan(0);
  expect(
    title.shown,
    `the name reads in ${title.shown}px of the ${title.available}px the row has`,
  ).toBeGreaterThanOrEqual(title.available - title.swatchRun);

  await expectChipsClearOfAmounts(page, "at 320 under a long category name");
  expect(await tooWideInside(page, "main")).toEqual([]);
});

test("the budget is still edited in the row, on a target a thumb can hit", async ({ page }) => {
  await openPhone(page, "/finance/categories");
  const chip = page.getByRole("button", { name: "Monthly budget for Software" });
  await expect(chip).toBeVisible({ timeout: 15_000 });

  const box = await chip.boundingBox();
  expect(
    box?.height ?? 0,
    "the budget chip is under the 44px phone minimum",
  ).toBeGreaterThanOrEqual(44);

  // Software already carries a $50 budget that carries forward, so only a distinctive figure tells
  // a working commit apart from a stale render.
  await chip.click();
  const field = page.getByRole("textbox", { name: "Monthly budget for Software" });
  await field.fill("777");
  await field.press("Enter");
  await expect(page.getByRole("button", { name: "Monthly budget for Software" })).toContainText(
    "$777.00",
  );
});

test("the row menu still offers every action the desktop row does", async ({ page }) => {
  await openPhone(page, "/finance/categories");
  const trigger = page.getByRole("button", { name: "Actions for Software" });
  await expectThumbSized(trigger, "the row-menu trigger");

  await trigger.click();

  for (const item of ["Edit", "Merge into…", "Archive", "Delete"]) {
    await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
  }
});

test("a category opens its own page and its rows card fits the column", async ({ page }) => {
  await openPhone(page, "/finance/categories");
  await page
    .getByRole("link", { name: /^Software\b/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/finance\/categories\/[^/]+$/);

  // The detail page hard-wires this month with no cursor, and Software's only row sits 20 days back,
  // so for most of a month the honest assertion is "rows or the empty string" — never a date bomb.
  const rows = region(page, "Rows in this category");
  await expect(rows).toBeVisible({ timeout: 15_000 });
  const link = rows.getByRole("link");
  const isEmpty = (await link.count()) === 0;
  if (isEmpty) {
    await expect(rows).toContainText("Nothing landed in this category this month.");
  } else {
    await expect(link.first()).toBeVisible();
  }

  expect(await tooWideInside(page, "main")).toEqual([]);
});

test("the settlement rows stack and keep every column as a labelled pair", async ({ page }) => {
  await openPhone(page, `/finance/settlement?month=${partnerHeavyMonth()}`);
  const rows = region(page, "Shared rows in this period");
  await expect(rows).toBeVisible({ timeout: 15_000 });

  await expect(rows.getByRole("link").first()).toBeVisible();
  for (const label of ["Paid by", "Full", "Mine", "Your share"]) {
    await expect(rows.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(rows.getByText(/\d+ rows? counted/)).toBeVisible();

  expect(await tooWideInside(page, '[aria-label="Shared rows in this period"]')).toEqual([]);
});

test("the filter chips still narrow the stacked list, empty state included", async ({ page }) => {
  await openPhone(page, `/finance/settlement?month=${settledMonth()}`);
  const rows = region(page, "Shared rows in this period");
  await expect(rows).toBeVisible({ timeout: 15_000 });

  for (const label of ["You paid", "Partner paid", "Missing split"]) {
    await expect(rows.getByRole("button", { name: label })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  }

  const links = rows.getByRole("link");
  await expect(links).toHaveCount(3);

  await rows.getByRole("button", { name: "Partner paid" }).click();
  await expect(rows.getByRole("button", { name: "Partner paid" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(links).toHaveCount(1);
  await expect(links).toHaveText(["Dinner out"]);
  await expect(rows.getByText("You", { exact: true })).toHaveCount(0);

  // No seeded row carries an unresolved flag in this period, so the empty state is this filter's
  // happy path rather than an edge case.
  await rows.getByRole("button", { name: "Missing split" }).click();
  await expect(rows).toContainText("No row in this period matches that filter.");
});

/** Long enough that the stacked row cannot draw it whole, short enough to keep its filter chip in. */
const LONG_PARTNER = "Anastasia Kowalczyk-Bell";

async function setPartnerName(page: Page, name: string) {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const field = page.getByRole("textbox", { name: "Partner name" });
  await expect(field).toBeVisible({ timeout: 15_000 });
  await field.fill(name);
  await expect(field).toHaveValue(name);
}

/** The value half of the row's `Paid by` pair — the one cell that ellipsises rather than wraps. */
async function measurePaidBy(page: Page) {
  return page.evaluate(() => {
    const label = Array.from(document.querySelectorAll("span")).find(
      (node) => node.textContent === "Paid by",
    );
    const value = label?.nextElementSibling ?? null;
    if (value === null) return null;
    return {
      text: value.textContent ?? "",
      isEllipsised: value.scrollWidth > value.clientWidth,
      overflow: Math.round(
        value.getBoundingClientRect().right - document.documentElement.clientWidth,
      ),
    };
  });
}

test("a long partner name is cut short rather than pushing the stacked row wide", async ({
  page,
}) => {
  await enterApp(page);
  await page.setViewportSize(NARROW);
  await setPartnerName(page, LONG_PARTNER);

  await page.goto(`/finance/settlement?month=${settledMonth()}`, {
    waitUntil: "domcontentloaded",
  });
  const rows = region(page, "Shared rows in this period");
  await expect(rows).toBeVisible({ timeout: 15_000 });
  await rows.getByRole("button", { name: `${LONG_PARTNER} paid` }).click();
  await expect(rows.getByRole("link")).toHaveCount(1);

  const paidBy = await measurePaidBy(page);
  expect(paidBy?.text, "the stacked row never names the partner").toBe(LONG_PARTNER);
  expect(paidBy?.isEllipsised, "the partner name is drawn whole instead of ellipsised").toBe(true);
  expect(paidBy?.overflow ?? 0, "the partner name runs past the viewport").toBeLessThanOrEqual(0);

  expect(await tooWideInside(page, '[aria-label="Shared rows in this period"]')).toEqual([]);
});

/** One token with nothing to break on, so the name alone sets the card's min-content width. */
const UNBROKEN_PARTNER = "Bartholomewfeatherstonehaughsonnenschein";

/**
 * Element boxes and `text-overflow` together: the period card kept its own 288px box while its
 * contents were laid out 835px wide, so only a per-descendant measurement sees the spill — and only
 * the computed `text-overflow` tells the name we deliberately ellipsise from text nobody can reach.
 */
async function measurePeriodCard(page: Page) {
  return page.evaluate(() => {
    const card = document.querySelector('[aria-label="The period being settled"]');
    if (card === null) return { past: ["no period card"], clipped: ["no period card"], cut: [] };

    const limit = document.documentElement.clientWidth + 1;
    const past: string[] = [];
    const clipped: string[] = [];
    const cut: string[] = [];
    const bucketOverflow = (element: Element, text: string) => {
      if (element.scrollWidth <= element.clientWidth + 1) return;
      if (getComputedStyle(element).textOverflow === "ellipsis") cut.push(text);
      else clipped.push(text);
    };
    for (const element of card.querySelectorAll("*")) {
      const text = (element.textContent ?? "").slice(0, 60);
      if (element.getBoundingClientRect().right > limit) past.push(text);
      bucketOverflow(element, text);
    }
    return { past, clipped, cut };
  });
}

test("a long partner name never pushes the period card off a 320px screen", async ({ page }) => {
  await enterApp(page);
  await page.setViewportSize(NARROW);
  await setPartnerName(page, UNBROKEN_PARTNER);

  await page.goto(`/finance/settlement?month=${partnerHeavyMonth()}`, {
    waitUntil: "domcontentloaded",
  });
  const card = region(page, "The period being settled");
  await expect(card).toBeVisible({ timeout: 15_000 });

  const measured = await measurePeriodCard(page);
  expect(measured.past, "the period card paints past the viewport").toEqual([]);
  expect(measured.clipped, "period-card text is cut off with no way to scroll to it").toEqual([]);
  expect(measured.cut, "the partner name is drawn whole instead of ellipsised").toContain(
    UNBROKEN_PARTNER,
  );

  await expect(card).toContainText(/owes you|You owe/);
  await expect(card).toContainText(/netted across \d+ rows?/);
  await expect(card).toContainText(/your true share \$/);
  await expect(card.getByRole("heading", { name: "Before you settle" })).toBeVisible();
});

/**
 * The chip is the one control whose label a person types into, and `main` does not scroll
 * sideways: a chip wider than the screen is a filter nobody can press. An email fits it, so only
 * a token with nothing to break on reaches this.
 */
test("the payer filter chip stays inside a 320px screen, and still filters", async ({ page }) => {
  await enterApp(page);
  await page.setViewportSize(NARROW);
  await setPartnerName(page, UNBROKEN_PARTNER);

  await page.goto(`/finance/settlement?month=${settledMonth()}`, { waitUntil: "domcontentloaded" });
  const rows = region(page, "Shared rows in this period");
  await expect(rows).toBeVisible({ timeout: 15_000 });

  const chip = rows.getByRole("button", { name: `${UNBROKEN_PARTNER} paid` });
  const box = await chip.boundingBox();
  expect(box?.x ?? -1, "the payer chip starts off the left of the screen").toBeGreaterThanOrEqual(
    0,
  );
  expect(
    (box?.x ?? 0) + (box?.width ?? 0),
    "the payer chip runs off a screen that cannot scroll to it",
  ).toBeLessThanOrEqual(NARROW.width);

  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(rows.getByRole("link")).toHaveCount(1);

  expect(await tooWideInside(page, '[aria-label="Shared rows in this period"]')).toEqual([]);
});

/** The two shapes a name breaks on differently: the email clips, the token overflows its box. */
const UNBOUNDED_NAMES = ["alexandra.fitzgerald@example.com", UNBROKEN_PARTNER];

/**
 * The dashboard's settle-up card carries no landmark of its own, so it is found through the one
 * line that names the partner. Its ancestors are measured too: the overflow escaped the card
 * itself, and `main` is `overflow-x-hidden`, so nothing past its edge could be scrolled back.
 */
async function measureSettleUpCard(page: Page) {
  return page.evaluate(() => {
    const describe = (node: Element) => `${node.tagName}[${node.getAttribute("class") ?? ""}]`;
    const headline = Array.from(document.querySelectorAll("main p")).find((node) =>
      /You owe|owes you|Square/.test(node.textContent ?? ""),
    );
    const card = headline?.closest("section") ?? null;
    if (headline === undefined || card === null) {
      return { text: "", past: ["no settle-up card"], clipped: ["no settle-up card"], page: 0 };
    }

    const measured: Element[] = [card, ...card.querySelectorAll("*")];
    for (let node = card.parentElement; node !== null; node = node.parentElement) {
      measured.push(node);
    }

    const limit = document.documentElement.clientWidth + 1;
    const isClippedText = (node: Element) =>
      node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).textOverflow !== "ellipsis";
    const past = measured
      .filter((node) => node.getBoundingClientRect().right > limit)
      .map(describe);
    const clipped = measured.filter(isClippedText).map(describe);
    return {
      text: headline.textContent ?? "",
      past,
      clipped,
      page: document.documentElement.scrollWidth,
    };
  });
}

for (const partner of UNBOUNDED_NAMES) {
  test(`the dashboard settle-up card holds "${partner}" inside a 320px screen`, async ({
    page,
  }) => {
    await enterApp(page);
    await page.setViewportSize(NARROW);
    await setPartnerName(page, partner);

    await page.goto("/finance", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

    const measured = await measureSettleUpCard(page);
    expect(measured.text, "the settle-up headline never names the partner").toContain(partner);
    expect(measured.past, "the settle-up card paints past the viewport").toEqual([]);
    expect(measured.clipped, "settle-up text is cut off with no way to scroll to it").toEqual([]);
    expect(measured.page, "the page gained sideways scroll").toBe(NARROW.width);
  });
}

/**
 * `tooWideInside` only sees an element wider than the whole screen, and the spill here was 24px on
 * a row that stayed inside it. So: every descendant's own right edge, plus the two halves of the
 * lead — the name may ellipsise, the direction that says who paid whom may not.
 */
async function measureHistoryLead(page: Page, partner: string, limit: number) {
  return page.evaluate(
    ({ wanted, edge }) => {
      const card = document.querySelector('[aria-label="Settled periods"]');
      if (card === null) return null;
      // The leaf that carries the name, whatever it is styled as: a finder keyed on `truncate`
      // could only ever report "not found" for the markup this is here to catch.
      const name = Array.from(card.querySelectorAll("span")).find(
        (node) => node.childElementCount === 0 && (node.textContent ?? "").startsWith(wanted),
      );
      if (name === undefined) return null;
      const phrase = name.nextElementSibling;

      return {
        nameText: name.textContent ?? "",
        isNameEllipsised:
          name.scrollWidth > name.clientWidth && getComputedStyle(name).textOverflow === "ellipsis",
        phraseText: phrase?.textContent ?? "",
        phraseRight: Math.round(phrase?.getBoundingClientRect().right ?? edge + 1),
        past: Array.from(card.querySelectorAll("*"))
          .filter((node) => node.getBoundingClientRect().right > edge + 0.5)
          .map((node) => `${node.tagName}[${node.getAttribute("class") ?? ""}]`),
      };
    },
    { wanted: partner, edge: limit },
  );
}

test("the settled-periods history stacks and still links each period", async ({ page }) => {
  await openPhone(page, `/finance/settlement?month=${partnerHeavyMonth()}`);
  const history = region(page, "Settled periods");
  await expect(history).toBeVisible({ timeout: 15_000 });

  const link = history.getByRole("link").first();
  await expect(link).toHaveAttribute("href", /\/finance\/settlement\?month=\d{4}-\d{2}/);

  expect(await tooWideInside(page, '[aria-label="Settled periods"]')).toEqual([]);

  await setPartnerName(page, UNBROKEN_PARTNER);
  await page.goto(`/finance/settlement?month=${partnerHeavyMonth()}`, {
    waitUntil: "domcontentloaded",
  });
  await page.setViewportSize(NARROW);
  await expect(history).toBeVisible({ timeout: 15_000 });
  await expect(history).toContainText(UNBROKEN_PARTNER);

  const lead = await measureHistoryLead(page, UNBROKEN_PARTNER, NARROW.width);
  expect(lead, "the settled row never split the partner name off the direction").not.toBeNull();
  expect(lead?.nameText, "the name is not the half that ellipsises").toBe(UNBROKEN_PARTNER);
  expect(lead?.isNameEllipsised, "the partner name is drawn whole instead of ellipsised").toBe(
    true,
  );
  expect(lead?.phraseText, "the ellipsis ate the direction, not just the name").toBe(" sent you");
  expect(
    lead?.phraseRight ?? 0,
    "the direction runs off a screen that cannot scroll",
  ).toBeLessThanOrEqual(NARROW.width);
  expect(lead?.past, "the settled row paints past a 320px screen").toEqual([]);
});

test("the import preview stacks, and the lens buttons still switch the list", async ({ page }) => {
  await openPhone(page, "/finance/import");
  await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles({
    name: "e2e-phone-statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(STATEMENT),
  });

  await expect(page.getByRole("heading", { name: "What will happen" })).toBeVisible();
  await expect(page.getByText("E2E PHONE COFFEE")).toBeVisible();

  await page.getByTestId("import-count-already-here").click();
  await expect(page.getByText("No rows read this way.")).toBeVisible();
  await page.getByTestId("import-count-will-add").click();
  await expect(page.getByText("E2E PHONE COFFEE")).toBeVisible();

  expect(await tooWideInside(page, "main")).toEqual([]);
});

test("the view strip fades where it is cut and hides the fade at the end", async ({ page }) => {
  await openPhone(page, "/finance");
  const strip = page.locator('nav[aria-label="Finance views"]');
  await expect(strip).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("finance-nav-fade")).toBeVisible();

  await strip.evaluate((node) => node.scrollTo({ left: node.scrollWidth }));
  await expect(page.getByTestId("finance-nav-fade")).toHaveCount(0);
});

test("landing on the last room scrolls its pill back into the strip", async ({ page }) => {
  await openPhone(page, "/finance/import");
  const strip = page.locator('nav[aria-label="Finance views"]');
  await expect(strip).toBeVisible({ timeout: 15_000 });

  const pressed = strip.locator('[aria-pressed="true"]');
  await expect(pressed).toHaveText(/Import/);

  const stripBox = await strip.boundingBox();
  const pillBox = await pressed.boundingBox();
  if (stripBox === null || pillBox === null) throw new Error("the strip or its pill has no box");
  expect(pillBox.x, "the pressed pill starts left of the strip").toBeGreaterThanOrEqual(
    stripBox.x - 1,
  );
  expect(
    pillBox.x + pillBox.width,
    "the pressed pill runs past the strip's right edge",
  ).toBeLessThanOrEqual(stripBox.x + stripBox.width + 1);
});

test("every account control on a phone is a target a thumb can hit", async ({ page }) => {
  await openPhone(page, "/finance/import");
  await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const newAccount = page
    .getByTestId("finance-accounts-card")
    .getByRole("button", { name: "New account" });
  await expectThumbSized(newAccount, "New account");

  await newAccount.click();
  await expectThumbSized(page.getByRole("button", { name: "Cancel" }), "Cancel");
  await expectThumbSized(page.getByRole("button", { name: "Create account" }), "Create account");
  await page.getByRole("button", { name: "Cancel" }).click();

  await clearFinanceStores(page, ["financeAccounts", "financeTransactions"]);
  await page.goto("/finance", { waitUntil: "networkidle" });
  await expect(page.getByText("Set up your first account")).toBeVisible({ timeout: 15_000 });
  await expectThumbSized(page.getByRole("button", { name: "Add an account" }), "Add an account");
});

const ACTION_PREFIX = "Actions for ";

interface RowOwnership {
  name: string;
  rowHeight: number;
  triggerHeight: number;
  escapesRowBy: number;
  stolenEdges: string[];
}

/**
 * The hit must land ON the trigger or inside it: counting an ancestor that merely contains the
 * trigger passes over a neighbour that has taken the edge outright.
 */
async function measureRowOwnership(page: Page): Promise<RowOwnership[]> {
  return page.evaluate((prefix) => {
    const selector = `[aria-label^="${prefix}"]`;
    const cardNode = document.querySelector('[data-testid="finance-accounts-card"]');
    if (cardNode === null) return [];

    return Array.from(cardNode.querySelectorAll<HTMLElement>(selector)).map((trigger) => {
      let row: HTMLElement = trigger;
      while (
        row.parentElement !== null &&
        row.parentElement.querySelectorAll(selector).length < 2
      ) {
        row = row.parentElement;
      }

      const rowBox = row.getBoundingClientRect();
      const box = trigger.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const stolenEdges: string[] = [];

      for (const [edge, y] of [
        ["top", box.top + 2],
        ["bottom", box.bottom - 2],
      ] as const) {
        const hit = document.elementFromPoint(x, y);
        if (hit !== null && trigger.contains(hit)) continue;
        const thief = hit?.closest(selector)?.getAttribute("aria-label");
        stolenEdges.push(`${edge} → ${thief ?? hit?.tagName ?? "nothing"}`);
      }

      return {
        name: (trigger.getAttribute("aria-label") ?? "").slice(prefix.length),
        rowHeight: Math.round(rowBox.height),
        triggerHeight: Math.round(box.height),
        escapesRowBy: Math.round(
          Math.max(0, rowBox.top - box.top) + Math.max(0, box.bottom - rowBox.bottom),
        ),
        stolenEdges,
      };
    });
  }, ACTION_PREFIX);
}

test("an account row's menu never reaches into the row below it", async ({ page }) => {
  await openPhone(page, "/finance/import");
  await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: `${ACTION_PREFIX}Rewards card` })).toBeVisible();
  await page.getByTestId("finance-accounts-card").scrollIntoViewIfNeeded();

  const rows = await measureRowOwnership(page);
  expect(rows.length, "the accounts card offered fewer than two row menus").toBeGreaterThanOrEqual(
    2,
  );
  expect(
    rows.filter((row) => row.triggerHeight > row.rowHeight),
    "a row menu is taller than the row that holds it",
  ).toEqual([]);
  expect(
    rows.filter((row) => row.escapesRowBy > 0),
    "a row menu paints past its own row",
  ).toEqual([]);
  expect(
    rows.filter((row) => row.stolenEdges.length > 0),
    "another row's menu owns this one's edge",
  ).toEqual([]);

  const first = rows[0];
  const trigger = page.getByRole("button", { name: `${ACTION_PREFIX}${first.name}` });
  const box = await trigger.boundingBox();
  if (box === null) throw new Error(`${first.name} has no menu box`);

  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 2);
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await expect(page.getByRole("textbox", { name: "Account name" })).toHaveValue(first.name);
});
