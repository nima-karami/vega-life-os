import type { FinanceMerchant } from "@vega/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PartialWriteError } from "@/core/persistence";
import { useStore } from "@/core/store";
import { pendingWriteCollections } from "@/core/store/persist";
import { type FinanceBulkHarness, installFinanceBulkHarness, rejectsWith } from "./bulk-harness";

vi.mock("@/core/persistence/sandbox-meta", () => ({
  setSandboxDirty: vi.fn(async () => {}),
  getSandboxDirty: vi.fn(async () => false),
  isSandboxDirty: () => false,
}));

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `ftxn_key${index}:0`,
    description: `row ${index}`,
    amountCents: -100 - index,
    txnDate: "2026-07-03",
    source: "import" as const,
  }));

const importStatement = (
  count: number,
  batchId: string,
  merchants: Partial<FinanceMerchant>[] = [],
) =>
  useStore.getState().importFinanceTransactions({
    transactions: rows(count),
    merchants,
    batch: { id: batchId, accountId: "facc_chequing" },
  });

let harness: FinanceBulkHarness;
beforeEach(() => {
  harness = installFinanceBulkHarness();
});

describe("importFinanceTransactions", () => {
  it("writes the rows through the batched seam and records the batch", async () => {
    const outcome = await importStatement(3, "fbat_1", [
      { id: "fmer_market", pattern: "GREEN MARKET", timesSeen: 5 },
    ]);

    expect(outcome).toEqual({ writtenRows: 3, writtenChunks: 1, failedChunk: null });
    expect(harness.callsFor("bulkPut", "financeMerchants")).toEqual([
      { op: "bulkPut", collection: "financeMerchants", rowCount: 1 },
    ]);
    expect(harness.callsFor("bulkPut", "financeTransactions")).toEqual([
      { op: "bulkPut", collection: "financeTransactions", rowCount: 3 },
    ]);
    expect(harness.read("financeTransactions")).toHaveLength(3);
    expect(harness.read("financeImportBatches")[0]).toMatchObject({
      id: "fbat_1",
      status: "committed",
      rowsInserted: 3,
      writtenChunks: 1,
    });
  });

  it("hands a 1,000-row statement to the backend in one call and reports its chunk count", async () => {
    const outcome = await importStatement(1000, "fbat_2");

    expect(outcome.writtenChunks).toBe(3);
    expect(harness.callsFor("bulkPut", "financeTransactions")).toHaveLength(1);
    expect(harness.read("financeTransactions")).toHaveLength(1000);
  });

  it("reports a partial commit from the backend's own count and keeps only what landed", async () => {
    harness.answerWith(
      rejectsWith(new PartialWriteError({ writtenRows: 450, writtenChunks: 1, failedChunk: 1 })),
    );

    const outcome = await importStatement(500, "fbat_3");

    expect(outcome).toEqual({ writtenRows: 450, writtenChunks: 1, failedChunk: 1 });
    expect(harness.read("financeTransactions")).toHaveLength(450);
    expect(harness.read("financeImportBatches")[0]).toMatchObject({
      status: "partial-commit",
      committedAt: null,
      writtenChunks: 1,
    });
  });

  it("keeps nothing when the whole call fails", async () => {
    harness.answerWith(rejectsWith(new Error("offline")));

    const outcome = await importStatement(3, "fbat_5");

    expect(outcome).toEqual({ writtenRows: 0, writtenChunks: 0, failedChunk: 0 });
    expect(harness.read("financeTransactions")).toHaveLength(0);
  });

  it("skips the transactions when the merchant sightings are rejected", async () => {
    harness.answerWith(rejectsWith(new Error("offline")));

    const outcome = await importStatement(3, "fbat_6", [{ id: "fmer_a", pattern: "A" }]);

    expect(outcome.writtenRows).toBe(0);
    expect(harness.callsFor("bulkPut", "financeTransactions")).toHaveLength(0);
    expect(harness.read("financeMerchants")).toHaveLength(0);
  });

  it("re-importing the same rows upserts on the built id instead of duplicating", async () => {
    await importStatement(2, "fbat_4");
    await importStatement(2, "fbat_4");

    expect(harness.read("financeTransactions")).toHaveLength(2);
  });
});

describe("an import in flight is protected from a refetch", () => {
  it("reports financeTransactions as pending until the import settles", async () => {
    const release = harness.holdCalls();
    const importing = importStatement(1000, "fbat_race");

    expect(pendingWriteCollections().has("financeTransactions")).toBe(true);

    release();
    await importing;

    expect(pendingWriteCollections().has("financeTransactions")).toBe(false);
    expect(harness.read("financeTransactions")).toHaveLength(1000);
  });

  it("a refetch mid-import cannot overwrite the rows it can't see yet", async () => {
    harness.serveOnRefetch({ financeTransactions: [] });
    const release = harness.holdCalls();
    const importing = importStatement(3, "fbat_race2");

    await useStore.getState().refetchCollection("financeTransactions");
    release();
    await importing;

    expect(harness.read("financeTransactions")).toHaveLength(3);

    // Once the write has settled the same refetch is free to reconcile.
    await useStore.getState().refetchCollection("financeTransactions");
    expect(harness.read("financeTransactions")).toHaveLength(0);
  });
});
