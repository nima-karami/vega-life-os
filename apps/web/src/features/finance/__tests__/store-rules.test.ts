import { beforeEach, describe, expect, it, vi } from "vitest";

const { savePut, saveRemove, bulkPut, landsEverything, setSandboxDirty } = vi.hoisted(() => {
  const landsEverything = async (_col: string, items: unknown[]) => ({
    inserted: items.length,
    skipped: 0,
    writtenChunks: 1,
  });
  return {
    savePut: vi.fn(),
    saveRemove: vi.fn(),
    bulkPut: vi.fn(landsEverything),
    landsEverything,
    setSandboxDirty: vi.fn(async () => {}),
  };
});
vi.mock("@/core/store/persist", () => ({ savePut, saveRemove }));
vi.mock("@/core/persistence/sandbox-meta", () => ({ setSandboxDirty }));
vi.mock("@/core/persistence", async () => ({
  persistence: { bulkPut },
  ...(await vi.importActual<typeof import("@/core/persistence/partial-write")>(
    "@/core/persistence/partial-write",
  )),
}));

import { create } from "zustand";
import { PartialWriteError } from "@/core/persistence/partial-write";
import { createFinanceSlice, type FinanceSlice } from "../store";

interface RetryToast {
  message: string;
  retry: () => void;
}

/** The finance slice plus the root-store members its bulk path reaches across for. */
type TestStore = FinanceSlice & {
  authUid: string | null;
  refetchCollection: (col: string) => Promise<void>;
  pushRetryToast: (message: string, onRetry: () => void) => void;
};

function mk() {
  const toasts: RetryToast[] = [];
  const refetched: string[] = [];
  const store = create<TestStore>((set, get, api) => ({
    ...createFinanceSlice(set as never, get as never, api as never),
    authUid: "uid_owner",
    refetchCollection: async (col) => {
      refetched.push(col);
    },
    pushRetryToast: (message, retry) => {
      toasts.push({ message, retry });
    },
  }));
  return { store, toasts, refetched };
}

const putCalls = (collection: string) =>
  bulkPut.mock.calls.filter(([col]) => col === collection).map(([, rows]) => rows);

beforeEach(() => {
  vi.clearAllMocks();
  bulkPut.mockImplementation(landsEverything);
});

describe("fileTransaction", () => {
  it("writes the category back to the merchant, born at this moment when it is unknown", () => {
    const { store } = mk();
    const groceries = store.getState().addFinanceCategory({ name: "Groceries" });
    const txn = store
      .getState()
      .addFinanceTransaction({ description: "GREEN MARKET #114", txnDate: "2026-07-03" });

    store.getState().fileTransaction(txn.id, { categoryId: groceries.id });

    const merchant = store.getState().financeMerchants[0];
    expect(merchant).toMatchObject({
      pattern: "GREEN MARKET #114",
      defaultCategoryId: groceries.id,
      timesSeen: 1,
      lastSeenAt: "2026-07-03",
    });
    expect(store.getState().financeTransactions[0]).toMatchObject({
      categoryId: groceries.id,
      merchantId: merchant.id,
    });
  });

  it("teaches a merchant it already knows rather than making a second one", () => {
    const { store } = mk();
    const dining = store.getState().addFinanceCategory({ name: "Dining out" });
    const known = store.getState().addFinanceMerchant({ pattern: "CORNER BISTRO", timesSeen: 9 });
    const txn = store.getState().addFinanceTransaction({ description: "Corner Bistro" });

    store.getState().fileTransaction(txn.id, { categoryId: dining.id });

    expect(store.getState().financeMerchants).toHaveLength(1);
    expect(store.getState().financeMerchants[0]).toMatchObject({
      id: known.id,
      timesSeen: 9,
      defaultCategoryId: dining.id,
    });
  });

  it("never writes a share back — the same merchant splits differently within one month", () => {
    const { store } = mk();
    const txn = store.getState().addFinanceTransaction({ description: "GREEN MARKET" });

    store.getState().fileTransaction(txn.id, { isHousehold: true, myShareBps: 5000 });

    expect(store.getState().financeMerchants).toEqual([]);
    expect(store.getState().financeTransactions[0]).toMatchObject({
      isHousehold: true,
      myShareBps: 5000,
    });
  });

  it("teaches nothing when a category is cleared", () => {
    const { store } = mk();
    const txn = store.getState().addFinanceTransaction({ description: "GREEN MARKET" });

    store.getState().fileTransaction(txn.id, { categoryId: null });

    expect(store.getState().financeMerchants).toEqual([]);
    expect(store.getState().financeTransactions[0].categoryId).toBeNull();
  });
});

describe("fileTransactions", () => {
  const seedSelection = (count: number) => {
    const { store, toasts, refetched } = mk();
    const category = store.getState().addFinanceCategory({ name: "Groceries" });
    const ids = Array.from({ length: count }, (_, index) =>
      store.getState().addFinanceTransaction({
        id: `ftxn_${index}`,
        description: `MERCHANT ${String.fromCharCode(65 + index)}`,
      }),
    ).map((txn) => txn.id);
    vi.clearAllMocks();
    bulkPut.mockImplementation(landsEverything);
    return { store, toasts, refetched, ids, category };
  };

  it("sends the whole selection in one call per collection, not one call per row", async () => {
    const { store, ids, category } = seedSelection(5);

    await store.getState().fileTransactions(ids, { categoryId: category.id });

    expect(putCalls("financeTransactions")).toHaveLength(1);
    expect(putCalls("financeTransactions")[0]).toHaveLength(5);
    expect(putCalls("financeMerchants")).toHaveLength(1);
    expect(putCalls("financeMerchants")[0]).toHaveLength(5);
    expect(savePut).not.toHaveBeenCalled();
    for (const txn of store.getState().financeTransactions) {
      expect(txn.categoryId).toBe(category.id);
      expect(txn.merchantId).not.toBeNull();
    }
  });

  it("skips the merchant write entirely when the patch carries no category", async () => {
    const { store, ids } = seedSelection(3);

    await store.getState().fileTransactions(ids, { isInternal: true });

    expect(putCalls("financeMerchants")).toHaveLength(0);
    expect(putCalls("financeTransactions")).toHaveLength(1);
    expect(store.getState().financeTransactions.every((txn) => txn.isInternal)).toBe(true);
  });

  it("reverts the selection and offers a Retry when the call is rejected", async () => {
    const { store, toasts, refetched, ids } = seedSelection(3);
    bulkPut.mockImplementation(async () => {
      throw new Error("offline");
    });

    await store.getState().fileTransactions(ids, { isHousehold: true });

    expect(store.getState().financeTransactions.some((txn) => txn.isHousehold)).toBe(false);
    expect(refetched).toContain("financeTransactions");
    expect(toasts).toHaveLength(1);

    bulkPut.mockImplementation(landsEverything);
    toasts[0].retry();
    await vi.waitFor(() =>
      expect(store.getState().financeTransactions.every((txn) => txn.isHousehold)).toBe(true),
    );
  });

  it("keeps exactly the prefix a partial commit landed", async () => {
    const { store, ids } = seedSelection(4);
    bulkPut.mockImplementation(async () => {
      throw new PartialWriteError({ writtenRows: 2, writtenChunks: 1, failedChunk: 1 });
    });

    await store.getState().fileTransactions(ids, { isHousehold: true });

    const landed = store.getState().financeTransactions.filter((txn) => txn.isHousehold);
    expect(landed.map((txn) => txn.id)).toEqual(["ftxn_0", "ftxn_1"]);
  });
});

describe("mergeFinanceCategories", () => {
  it("moves rows and merchant defaults in one call each, drops the source's budgets, archives it", async () => {
    const { store } = mk();
    const source = store.getState().addFinanceCategory({ name: "Food" });
    const target = store.getState().addFinanceCategory({ name: "Groceries" });
    store.getState().addFinanceTransaction({ id: "ftxn_a", categoryId: source.id });
    store.getState().addFinanceTransaction({ id: "ftxn_b", categoryId: source.id });
    store.getState().addFinanceTransaction({ id: "ftxn_c", categoryId: target.id });
    store.getState().addFinanceMerchant({ pattern: "MARKET", defaultCategoryId: source.id });
    store.getState().addFinanceBudget({ categoryId: source.id, month: "2026-06", cents: 40000 });
    store.getState().addFinanceBudget({ categoryId: source.id, month: "2026-07", cents: 50000 });
    store.getState().addFinanceBudget({ categoryId: target.id, month: "2026-07", cents: 57500 });
    vi.clearAllMocks();
    bulkPut.mockImplementation(landsEverything);

    await store.getState().mergeFinanceCategories(source.id, target.id);

    expect(putCalls("financeTransactions")).toHaveLength(1);
    expect(putCalls("financeTransactions")[0]).toHaveLength(2);
    expect(putCalls("financeMerchants")).toHaveLength(1);
    expect(store.getState().financeTransactions.every((txn) => txn.categoryId === target.id)).toBe(
      true,
    );
    expect(store.getState().financeMerchants[0].defaultCategoryId).toBe(target.id);
    expect(store.getState().financeBudgets.map((budget) => budget.categoryId)).toEqual([target.id]);
    expect(
      store.getState().financeCategories.find((cat) => cat.id === source.id)?.archivedAt,
    ).not.toBeNull();
  });
});

describe("rollBackFinanceImport", () => {
  it("takes the batch's own rows and the batch record, and leaves everything else", () => {
    const { store } = mk();
    store.getState().addFinanceImportBatch({ id: "fbat_1" });
    store.getState().addFinanceTransaction({ id: "ftxn_a", importBatchId: "fbat_1" });
    store.getState().addFinanceTransaction({ id: "ftxn_b", importBatchId: "fbat_1" });
    store.getState().addFinanceTransaction({ id: "ftxn_c", importBatchId: "fbat_2" });

    store.getState().rollBackFinanceImport("fbat_1");

    expect(store.getState().financeTransactions.map((txn) => txn.id)).toEqual(["ftxn_c"]);
    expect(store.getState().financeImportBatches).toEqual([]);
    expect(saveRemove).toHaveBeenCalledWith("financeImportBatches", "fbat_1", expect.anything());
  });
});
