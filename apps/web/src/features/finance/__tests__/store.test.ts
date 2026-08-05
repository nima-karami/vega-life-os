import { beforeEach, describe, expect, it, vi } from "vitest";

const { savePut, saveRemove } = vi.hoisted(() => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
}));
vi.mock("@/core/store/persist", () => ({ savePut, saveRemove }));

import { create } from "zustand";
import { todayISO } from "@/core/lib/date";
import { createFinanceSlice, type FinanceSlice } from "../store";

const mk = () =>
  create<FinanceSlice>((set, get, api) =>
    createFinanceSlice(set as never, get as never, api as never),
  );

beforeEach(() => vi.clearAllMocks());

describe("finance slice", () => {
  it("adds a transaction on the manual-entry defaults and persists it as an insert", () => {
    const s = mk();
    const txn = s.getState().addFinanceTransaction({ description: "Coffee", amountCents: -1240 });

    expect(txn.id.startsWith("ftxn_")).toBe(true);
    expect(txn).toMatchObject({
      description: "Coffee",
      amountCents: -1240,
      txnDate: todayISO(),
      currency: "CAD",
      payer: "me",
      source: "manual",
      enteredBy: "me",
      spreadMonths: 1,
      myShareBps: 10000,
      isHousehold: false,
      isInternal: false,
    });
    expect(s.getState().financeTransactions).toEqual([txn]);
    expect(savePut).toHaveBeenCalledWith("financeTransactions", txn, { kind: "insert" });
  });

  it("updates a row through a patch and hands the prior row to the rollback", () => {
    const s = mk();
    const category = s.getState().addFinanceCategory({ name: "Groceries" });
    s.getState().updateFinanceCategory(category.id, { name: "Food" });

    expect(s.getState().financeCategories[0].name).toBe("Food");
    expect(savePut).toHaveBeenLastCalledWith(
      "financeCategories",
      expect.objectContaining({ id: category.id, name: "Food" }),
      { kind: "update", prior: category },
    );
  });

  it("orders new categories after the existing ones", () => {
    const s = mk();
    s.getState().addFinanceCategory({ name: "Groceries" });
    const second = s.getState().addFinanceCategory({ name: "Dining" });
    expect(second.order).toBe(1);
  });

  it("removes a row and keeps the prior copy for the rollback", () => {
    const s = mk();
    const merchant = s.getState().addFinanceMerchant({ pattern: "GREEN MARKET" });
    s.getState().removeFinanceMerchant(merchant.id);

    expect(s.getState().financeMerchants).toEqual([]);
    expect(saveRemove).toHaveBeenCalledWith("financeMerchants", merchant.id, merchant);
  });

  it("ignores an update or a remove for an id that isn't there", () => {
    const s = mk();
    s.getState().updateFinanceAccount("missing", { displayName: "Nope" });
    s.getState().removeFinanceAccount("missing");
    expect(savePut).not.toHaveBeenCalled();
    expect(saveRemove).not.toHaveBeenCalled();
  });

  it("keys a budget by category and month, so re-adding the same month replaces the row", () => {
    const s = mk();
    const first = s.getState().addFinanceBudget({
      categoryId: "fcat_groceries",
      month: "2026-07",
      cents: 50000,
    });
    expect(first.id).toBe("fcat_groceries:2026-07");

    const second = s.getState().addFinanceBudget({
      categoryId: "fcat_groceries",
      month: "2026-07",
      cents: 55000,
    });
    expect(s.getState().financeBudgets).toEqual([second]);
    expect(savePut).toHaveBeenLastCalledWith("financeBudgets", second, {
      kind: "update",
      prior: first,
    });
  });

  it("keys a settlement by its month and opens it unsettled", () => {
    const s = mk();
    const settlement = s.getState().addFinanceSettlement({ month: "2026-07" });
    expect(settlement).toMatchObject({
      id: "2026-07",
      month: "2026-07",
      status: "open",
      settledBalanceCents: null,
      carriedDeltaCents: 0,
    });
  });

  it("gives every row its own fieldUpdatedAt map", () => {
    const s = mk();
    const first = s.getState().addFinanceImportBatch({ accountId: "facc_a" });
    const second = s.getState().addFinanceImportBatch({ accountId: "facc_b" });
    expect(first.fieldUpdatedAt).not.toBe(second.fieldUpdatedAt);
  });
});
