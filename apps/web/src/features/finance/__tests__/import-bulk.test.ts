import { beforeEach, describe, expect, it, vi } from "vitest";

const { savePut, saveRemove, bulkPut, landsEverything } = vi.hoisted(() => {
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
  };
});
vi.mock("@/core/store/persist", () => ({ savePut, saveRemove }));
vi.mock("@/core/persistence", async () => ({
  persistence: { bulkPut },
  ...(await vi.importActual<typeof import("@/core/persistence/partial-write")>(
    "@/core/persistence/partial-write",
  )),
}));

import { create } from "zustand";
import { PartialWriteError } from "@/core/persistence/partial-write";
import { createFinanceSlice, type FinanceSlice } from "../store";

const mk = () =>
  create<FinanceSlice>((set, get, api) =>
    createFinanceSlice(set as never, get as never, api as never),
  );

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `ftxn_key${index}:0`,
    description: `row ${index}`,
    amountCents: -100 - index,
    txnDate: "2026-07-03",
    source: "import" as const,
  }));

beforeEach(() => {
  vi.clearAllMocks();
  bulkPut.mockImplementation(landsEverything);
});

describe("importFinanceTransactions", () => {
  it("writes the rows through the adapter's batched path and records the batch", async () => {
    const s = mk();
    const outcome = await s.getState().importFinanceTransactions({
      transactions: rows(3),
      merchants: [{ id: "fmer_market", pattern: "GREEN MARKET", timesSeen: 5 }],
      batch: { id: "fbat_1", accountId: "facc_chequing", rowsParsed: 4, rowsSkipped: 1 },
    });

    expect(outcome).toEqual({ writtenRows: 3, writtenChunks: 1, failedChunk: null });
    expect(bulkPut).toHaveBeenCalledWith("financeMerchants", [
      expect.objectContaining({ id: "fmer_market", timesSeen: 5 }),
    ]);
    expect(bulkPut).toHaveBeenCalledWith("financeTransactions", expect.arrayContaining([]));
    expect(s.getState().financeTransactions).toHaveLength(3);
    expect(s.getState().financeImportBatches[0]).toMatchObject({
      id: "fbat_1",
      status: "committed",
      rowsInserted: 3,
      rowsSkipped: 1,
      writtenChunks: 1,
    });
  });

  it("hands a large import to the backend in one call and reports its chunk count", async () => {
    const s = mk();
    bulkPut.mockImplementation(async (_col, items) => ({
      inserted: items.length,
      skipped: 0,
      writtenChunks: 3,
    }));

    const outcome = await s.getState().importFinanceTransactions({
      transactions: rows(901),
      merchants: [],
      batch: { id: "fbat_2" },
    });

    expect(outcome.writtenChunks).toBe(3);
    expect(bulkPut).toHaveBeenCalledTimes(1);
    expect(s.getState().financeTransactions).toHaveLength(901);
  });

  it("reports a partial commit from the backend's own count and keeps only what landed", async () => {
    const s = mk();
    bulkPut.mockImplementation(async () => {
      throw new PartialWriteError({ writtenRows: 450, writtenChunks: 1, failedChunk: 1 });
    });

    const outcome = await s.getState().importFinanceTransactions({
      transactions: rows(500),
      merchants: [],
      batch: { id: "fbat_3" },
    });

    expect(outcome).toEqual({ writtenRows: 450, writtenChunks: 1, failedChunk: 1 });
    expect(s.getState().financeTransactions).toHaveLength(450);
    expect(s.getState().financeImportBatches[0]).toMatchObject({
      status: "partial-commit",
      committedAt: null,
      writtenChunks: 1,
    });
  });

  it("keeps nothing when the whole call fails", async () => {
    const s = mk();
    bulkPut.mockImplementation(async () => {
      throw new Error("offline");
    });

    const outcome = await s.getState().importFinanceTransactions({
      transactions: rows(3),
      merchants: [],
      batch: { id: "fbat_5" },
    });

    expect(outcome).toEqual({ writtenRows: 0, writtenChunks: 0, failedChunk: 0 });
    expect(s.getState().financeTransactions).toHaveLength(0);
  });

  it("re-importing the same rows upserts on the built id instead of duplicating", async () => {
    const s = mk();
    const input = { transactions: rows(2), merchants: [], batch: { id: "fbat_4" } };
    await s.getState().importFinanceTransactions(input);
    await s.getState().importFinanceTransactions(input);

    expect(s.getState().financeTransactions).toHaveLength(2);
  });
});
