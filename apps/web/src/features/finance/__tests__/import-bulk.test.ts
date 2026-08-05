import { beforeEach, describe, expect, it, vi } from "vitest";

const { savePut, saveRemove, bulkPut } = vi.hoisted(() => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
  bulkPut: vi.fn(async () => {}),
}));
vi.mock("@/core/store/persist", () => ({ savePut, saveRemove }));
vi.mock("@/core/persistence", () => ({ persistence: { bulkPut } }));

import { create } from "zustand";
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
  bulkPut.mockImplementation(async () => {});
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

  it("splits a large import into 450-row chunks", async () => {
    const s = mk();
    const outcome = await s.getState().importFinanceTransactions({
      transactions: rows(901),
      merchants: [],
      batch: { id: "fbat_2" },
    });

    expect(outcome.writtenChunks).toBe(3);
    expect(bulkPut).toHaveBeenCalledTimes(3);
    expect(s.getState().financeTransactions).toHaveLength(901);
  });

  it("reports a partial commit and keeps only the rows that landed", async () => {
    const s = mk();
    let call = 0;
    bulkPut.mockImplementation(async () => {
      call += 1;
      if (call === 2) throw new Error("rejected");
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

  it("re-importing the same rows upserts on the built id instead of duplicating", async () => {
    const s = mk();
    const input = { transactions: rows(2), merchants: [], batch: { id: "fbat_4" } };
    await s.getState().importFinanceTransactions(input);
    await s.getState().importFinanceTransactions(input);

    expect(s.getState().financeTransactions).toHaveLength(2);
  });
});
