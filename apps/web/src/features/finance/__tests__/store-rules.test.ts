import { beforeEach, describe, expect, it, vi } from "vitest";
import { PartialWriteError } from "@/core/persistence";
import { useStore } from "@/core/store";
import { setPersistAuth } from "@/core/store/persist";
import { buildTransaction } from "../row-builders";
import {
  type FinanceBulkHarness,
  installFinanceBulkHarness,
  landsEverything,
  rejectsWith,
} from "./bulk-harness";

const { setSandboxDirty } = vi.hoisted(() => ({ setSandboxDirty: vi.fn(async () => {}) }));
vi.mock("@/core/persistence/sandbox-meta", () => ({
  setSandboxDirty,
  getSandboxDirty: vi.fn(async () => false),
  isSandboxDirty: () => false,
}));

let harness: FinanceBulkHarness;
beforeEach(() => {
  harness = installFinanceBulkHarness();
});

const store = () => useStore.getState();

const seedTransactions = (count: number, patch: (index: number) => object = () => ({})) => {
  const rows = Array.from({ length: count }, (_, index) =>
    buildTransaction({ id: `ftxn_${index}`, description: `MERCHANT ${index}`, ...patch(index) }),
  );
  harness.seed({ financeTransactions: rows });
  return rows.map((row) => row.id);
};

describe("fileTransaction", () => {
  it("writes the category back to the merchant, born at this moment when it is unknown", () => {
    const groceries = store().addFinanceCategory({ name: "Groceries" });
    const txn = store().addFinanceTransaction({
      description: "GREEN MARKET #114",
      txnDate: "2026-07-03",
    });

    store().fileTransaction(txn.id, { categoryId: groceries.id });

    const merchant = harness.read("financeMerchants")[0];
    expect(merchant).toMatchObject({
      pattern: "GREEN MARKET #114",
      defaultCategoryId: groceries.id,
      timesSeen: 1,
      lastSeenAt: "2026-07-03",
    });
    expect(harness.read("financeTransactions")[0]).toMatchObject({
      categoryId: groceries.id,
      merchantId: merchant.id,
    });
  });

  it("teaches a merchant it already knows rather than making a second one", () => {
    const dining = store().addFinanceCategory({ name: "Dining out" });
    const known = store().addFinanceMerchant({ pattern: "CORNER BISTRO", timesSeen: 9 });
    const txn = store().addFinanceTransaction({ description: "Corner Bistro" });

    store().fileTransaction(txn.id, { categoryId: dining.id });

    expect(harness.read("financeMerchants")).toHaveLength(1);
    expect(harness.read("financeMerchants")[0]).toMatchObject({
      id: known.id,
      timesSeen: 9,
      defaultCategoryId: dining.id,
    });
  });

  it("never writes a share back — the same merchant splits differently within one month", () => {
    const txn = store().addFinanceTransaction({ description: "GREEN MARKET" });

    store().fileTransaction(txn.id, { isHousehold: true, myShareBps: 5000 });

    expect(harness.read("financeMerchants")).toEqual([]);
    expect(harness.read("financeTransactions")[0]).toMatchObject({
      isHousehold: true,
      myShareBps: 5000,
    });
  });

  it("teaches nothing when a category is cleared", () => {
    const txn = store().addFinanceTransaction({ description: "GREEN MARKET" });

    store().fileTransaction(txn.id, { categoryId: null });

    expect(harness.read("financeMerchants")).toEqual([]);
    expect(harness.read("financeTransactions")[0].categoryId).toBeNull();
  });
});

describe("fileTransactions", () => {
  it("sends the whole selection in one call per collection, not one call per row", async () => {
    const category = store().addFinanceCategory({ name: "Groceries" });
    const ids = seedTransactions(5);

    await store().fileTransactions(ids, { categoryId: category.id });

    expect(harness.callsFor("bulkPut", "financeTransactions")).toEqual([
      { op: "bulkPut", collection: "financeTransactions", rowCount: 5 },
    ]);
    expect(harness.callsFor("bulkPut", "financeMerchants")).toEqual([
      { op: "bulkPut", collection: "financeMerchants", rowCount: 5 },
    ]);
    expect(harness.callsFor("put", "financeTransactions")).toHaveLength(0);
    for (const txn of harness.read("financeTransactions")) {
      expect(txn.categoryId).toBe(category.id);
      expect(txn.merchantId).not.toBeNull();
    }
  });

  it("skips the merchant write entirely when the patch carries no category", async () => {
    const ids = seedTransactions(3);

    await store().fileTransactions(ids, { isInternal: true });

    expect(harness.callsFor("bulkPut", "financeMerchants")).toHaveLength(0);
    expect(harness.callsFor("bulkPut", "financeTransactions")).toHaveLength(1);
    expect(harness.read("financeTransactions").every((txn) => txn.isInternal)).toBe(true);
  });

  it("reverts the selection and offers a Retry that re-issues the one batched write", async () => {
    const ids = seedTransactions(3);
    harness.answerWith(rejectsWith(new Error("offline")));

    await store().fileTransactions(ids, { isHousehold: true });

    expect(harness.read("financeTransactions").some((txn) => txn.isHousehold)).toBe(false);
    const toast = useStore.getState().toast;
    expect(toast?.action?.label).toBe("Retry");

    harness.answerWith(landsEverything);
    toast?.action?.onClick();
    await vi.waitFor(() =>
      expect(harness.callsFor("bulkPut", "financeTransactions")).toHaveLength(2),
    );
    expect(harness.callsFor("bulkPut", "financeTransactions")[1].rowCount).toBe(3);
  });

  it("keeps exactly the prefix a partial commit landed", async () => {
    const ids = seedTransactions(4);
    harness.answerWith(
      rejectsWith(new PartialWriteError({ writtenRows: 2, writtenChunks: 1, failedChunk: 1 })),
    );

    await store().fileTransactions(ids, { isHousehold: true });

    const landed = harness.read("financeTransactions").filter((txn) => txn.isHousehold);
    expect(landed.map((txn) => txn.id)).toEqual(["ftxn_0", "ftxn_1"]);
  });
});

describe("removeFinanceTransactions", () => {
  it("deletes a 200-row selection in one batched call", async () => {
    const ids = seedTransactions(200);

    await store().removeFinanceTransactions(ids);

    expect(harness.callsFor("bulkRemove", "financeTransactions")).toEqual([
      { op: "bulkRemove", collection: "financeTransactions", rowCount: 200 },
    ]);
    expect(harness.callsFor("remove", "financeTransactions")).toHaveLength(0);
    expect(harness.read("financeTransactions")).toEqual([]);
  });

  it("puts every row back and offers a Retry when the delete is rejected", async () => {
    const ids = seedTransactions(3);
    harness.answerWith(rejectsWith(new Error("offline")));

    await store().removeFinanceTransactions(ids);

    expect(
      harness
        .read("financeTransactions")
        .map((txn) => txn.id)
        .sort(),
    ).toEqual(ids);
    expect(useStore.getState().toast?.action?.label).toBe("Retry");
  });

  it("keeps the landed deletions and restores only the rest on a partial delete", async () => {
    const ids = seedTransactions(4);
    harness.answerWith(
      rejectsWith(new PartialWriteError({ writtenRows: 2, writtenChunks: 1, failedChunk: 1 })),
    );

    await store().removeFinanceTransactions(ids);

    expect(
      harness
        .read("financeTransactions")
        .map((txn) => txn.id)
        .sort(),
    ).toEqual(["ftxn_2", "ftxn_3"]);
  });

  it("writes nothing when none of the ids are in the book", async () => {
    seedTransactions(2);

    await store().removeFinanceTransactions(["ftxn_ghost"]);

    expect(harness.callsFor("bulkRemove", "financeTransactions")).toHaveLength(0);
    expect(harness.read("financeTransactions")).toHaveLength(2);
  });

  it("flags the sandbox dirty when the batched delete runs signed out", async () => {
    const ids = seedTransactions(2);
    setPersistAuth(null);
    setSandboxDirty.mockClear();

    await store().removeFinanceTransactions(ids);

    expect(setSandboxDirty).toHaveBeenCalledWith(true);
  });
});

describe("mergeFinanceCategories", () => {
  it("moves rows and merchant defaults in one call each, drops the source's budgets, archives it", async () => {
    const source = store().addFinanceCategory({ name: "Food" });
    const target = store().addFinanceCategory({ name: "Groceries" });
    harness.seed({
      financeTransactions: [
        buildTransaction({ id: "ftxn_a", categoryId: source.id }),
        buildTransaction({ id: "ftxn_b", categoryId: source.id }),
        buildTransaction({ id: "ftxn_c", categoryId: target.id }),
      ],
    });
    store().addFinanceMerchant({ pattern: "MARKET", defaultCategoryId: source.id });
    store().addFinanceBudget({ categoryId: source.id, month: "2026-06", cents: 40000 });
    store().addFinanceBudget({ categoryId: source.id, month: "2026-07", cents: 50000 });
    store().addFinanceBudget({ categoryId: target.id, month: "2026-07", cents: 57500 });

    await store().mergeFinanceCategories(source.id, target.id);

    expect(harness.callsFor("bulkPut", "financeTransactions")).toEqual([
      { op: "bulkPut", collection: "financeTransactions", rowCount: 2 },
    ]);
    expect(harness.callsFor("bulkPut", "financeMerchants")).toHaveLength(1);
    expect(harness.callsFor("bulkRemove", "financeBudgets")).toEqual([
      { op: "bulkRemove", collection: "financeBudgets", rowCount: 2 },
    ]);
    expect(harness.callsFor("remove", "financeBudgets")).toHaveLength(0);
    expect(harness.read("financeTransactions").every((txn) => txn.categoryId === target.id)).toBe(
      true,
    );
    expect(harness.read("financeMerchants")[0].defaultCategoryId).toBe(target.id);
    expect(harness.read("financeBudgets").map((budget) => budget.categoryId)).toEqual([target.id]);
    expect(
      harness.read("financeCategories").find((cat) => cat.id === source.id)?.archivedAt,
    ).not.toBeNull();
  });
});

describe("rollBackFinanceImport", () => {
  it("takes a 1,000-row batch out in one call and leaves everything else", async () => {
    store().addFinanceImportBatch({ id: "fbat_1" });
    const ids = seedTransactions(1001, (index) => ({
      importBatchId: index === 1000 ? "fbat_2" : "fbat_1",
    }));

    await store().rollBackFinanceImport("fbat_1");

    expect(harness.callsFor("bulkRemove", "financeTransactions")).toEqual([
      { op: "bulkRemove", collection: "financeTransactions", rowCount: 1000 },
    ]);
    expect(harness.callsFor("remove", "financeTransactions")).toHaveLength(0);
    expect(harness.read("financeTransactions").map((txn) => txn.id)).toEqual([ids[1000]]);
    expect(harness.read("financeImportBatches")).toEqual([]);
    expect(harness.callsFor("remove", "financeImportBatches")).toHaveLength(1);
  });
});
