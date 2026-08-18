import { describe, expect, it } from "vitest";
import {
  applyHouseholdToggle,
  applyMerchantPick,
  applyPayerPick,
  buildNewTransactionPatch,
  canCommitTransactionForm,
  createTransactionForm,
  describeFormErrors,
  diffTransactionPatch,
  readAmountCents,
  readShareBps,
  readTransactionForm,
  selectAssignableCategories,
} from "../transaction-form";
import { row } from "./fixtures";

const filled = () => ({
  ...createTransactionForm("2026-08-11"),
  title: "Desk lamp for the study",
  amountInput: "129.99",
});

describe("reading a stored row into the form", () => {
  it("keeps money-in rows money-in, and shows the magnitude either way", () => {
    const income = readTransactionForm(row("2026-08-11", 480000));
    expect(income.amountInput).toBe("4800.00");
    expect(income.isMoneyIn).toBe(true);

    const charge = readTransactionForm(row("2026-08-11", -12999));
    expect(charge.amountInput).toBe("129.99");
    expect(charge.isMoneyIn).toBe(false);
  });

  it("offers the even split as the percent on a row that is not shared yet", () => {
    expect(readTransactionForm(row("2026-08-11", -12999)).sharePercentInput).toBe("50");
  });

  it("reads the stored share on a row that is shared", () => {
    const shared = row("2026-08-11", -12999, { isHousehold: true, myShareBps: 8000 });
    expect(readTransactionForm(shared).sharePercentInput).toBe("80");
  });
});

describe("what the form derives", () => {
  it("signs a charge negative and an income positive", () => {
    expect(readAmountCents(filled())).toBe(-12999);
    expect(readAmountCents({ ...filled(), isMoneyIn: true })).toBe(12999);
  });

  it("refuses a zero and a half-typed amount", () => {
    expect(readAmountCents({ ...filled(), amountInput: "0" })).toBeNull();
    expect(readAmountCents({ ...filled(), amountInput: "12." })).toBeNull();
    expect(readAmountCents({ ...filled(), amountInput: "abc" })).toBeNull();
  });

  it("applies the whole charge when the row is not shared, whatever the percent field holds", () => {
    expect(readShareBps({ ...filled(), sharePercentInput: "80" })).toBe(10000);
    expect(readShareBps({ ...filled(), isHousehold: true, sharePercentInput: "80" })).toBe(8000);
  });
});

describe("what the form refuses to commit", () => {
  it("wants a title and an amount before anything is written", () => {
    const blank = createTransactionForm("2026-08-11");
    const errors = describeFormErrors(blank);
    expect(errors.title).not.toBeNull();
    expect(errors.amount).not.toBeNull();
    expect(canCommitTransactionForm(blank)).toBe(false);
    expect(buildNewTransactionPatch(blank)).toBeNull();
  });

  it("refuses a share outside 0–100 and a spread outside 1–36", () => {
    const shared = { ...filled(), isHousehold: true, sharePercentInput: "120" };
    expect(describeFormErrors(shared).share).not.toBeNull();
    expect(describeFormErrors({ ...filled(), spreadMonthsInput: "48" }).spread).not.toBeNull();
    expect(describeFormErrors({ ...filled(), spreadMonthsInput: "12" }).spread).toBeNull();
  });

  it("commits a filled form as a manual row whose title seeds the description", () => {
    const patch = buildNewTransactionPatch(filled());
    expect(patch).toMatchObject({
      title: "Desk lamp for the study",
      description: "Desk lamp for the study",
      amountCents: -12999,
      txnDate: "2026-08-11",
      source: "manual",
      enteredBy: "me",
      myShareBps: 10000,
      spreadMonths: 1,
    });
  });

  it("marks a partner-paid row as partner-reported", () => {
    const patch = buildNewTransactionPatch(applyPayerPick(filled(), "partner"));
    expect(patch).toMatchObject({ enteredBy: "partner-reported", isHousehold: true });
  });
});

describe("the patch an edit writes", () => {
  const stored = row("2026-08-11", -12999, { title: "Desk lamp", description: "AMZN MKTP CA" });

  it("writes nothing when nothing moved", () => {
    expect(diffTransactionPatch(stored, readTransactionForm(stored))).toEqual({});
  });

  it("never carries the raw bank description, whatever the title becomes", () => {
    const patch = diffTransactionPatch(stored, {
      ...readTransactionForm(stored),
      title: "Desk lamp for the study",
    });
    expect(patch).toEqual({ title: "Desk lamp for the study" });
    expect(patch).not.toHaveProperty("description");
  });

  it("holds the stored figure while an amount is half-typed", () => {
    const patch = diffTransactionPatch(stored, {
      ...readTransactionForm(stored),
      amountInput: "",
    });
    expect(patch).toEqual({});
  });

  it("carries the share and the flag together when a row turns shared", () => {
    const values = applyHouseholdToggle(readTransactionForm(stored), true);
    expect(diffTransactionPatch(stored, values)).toEqual({ isHousehold: true, myShareBps: 5000 });
  });
});

describe("the controls that move more than one field", () => {
  it("offers the even split the first time a row turns shared", () => {
    const shared = applyHouseholdToggle(filled(), true);
    expect(shared.sharePercentInput).toBe("50");
  });

  it("leaves a share the owner already set alone", () => {
    const kept = applyHouseholdToggle({ ...filled(), sharePercentInput: "80" }, true);
    expect(kept.sharePercentInput).toBe("80");
  });

  it("makes a partner-paid row shared, because that is the only reason it is on the books", () => {
    const partner = applyPayerPick(filled(), "partner");
    expect(partner).toMatchObject({ payer: "partner", isHousehold: true, sharePercentInput: "50" });
  });

  it("names the row after the merchant, until the owner names it themselves", () => {
    const first = applyMerchantPick(createTransactionForm("2026-08-11"), "m1", "Shopfront.ca", "");
    expect(first.title).toBe("Shopfront.ca");

    const repicked = applyMerchantPick(first, "m2", "Green Market", "Shopfront.ca");
    expect(repicked.title).toBe("Green Market");

    const owned = applyMerchantPick(
      { ...first, title: "Desk lamp" },
      "m2",
      "Green Market",
      "Shopfront.ca",
    );
    expect(owned.title).toBe("Desk lamp");
  });
});

describe("which categories filing offers", () => {
  it("drops archived ones and keeps the owner's order", () => {
    const categories = [
      { id: "b", name: "B", kind: "spend" as const, order: 1, colorIndex: null, archivedAt: null },
      { id: "a", name: "A", kind: "spend" as const, order: 0, colorIndex: null, archivedAt: null },
      { id: "z", name: "Z", kind: "spend" as const, order: 2, colorIndex: null, archivedAt: "x" },
    ].map((category) => ({ ...category, updatedAt: "", fieldUpdatedAt: {} }));
    expect(selectAssignableCategories(categories).map((category) => category.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
