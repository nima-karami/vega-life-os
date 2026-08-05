import { describe, expect, it } from "vitest";
import { findNearDuplicates, type NearDuplicateRow } from "../import/near-duplicate";
import type { NearDuplicateSubject } from "../import/types";

const PENDING_KEY = "aaaaaaaaaaaaaaaa:0";

const pending: NearDuplicateSubject = {
  id: "txn-pending",
  accountId: "acct-card",
  txnDate: "2026-07-03",
  amountCents: -10_000,
  dedupeKey: PENDING_KEY,
};

const posted = (overrides: Partial<NearDuplicateRow> = {}): NearDuplicateRow => ({
  sourceRowNumber: 2,
  txnDate: "2026-07-05",
  amountCents: -11_500,
  dedupeKey: "bbbbbbbbbbbbbbbb:0",
  ...overrides,
});

const find = (row: NearDuplicateRow, existing = [pending], accountId = "acct-card") =>
  findNearDuplicates([row], existing, accountId);

describe("findNearDuplicates — the pending-vs-posted case", () => {
  it("raises a candidate when a tip moved the amount inside the window", () => {
    expect(find(posted())).toEqual([
      {
        sourceRowNumber: 2,
        existingTransactionId: "txn-pending",
        dayGap: 2,
        amountDeltaCents: -1_500,
      },
    ]);
  });

  it("raises a candidate at exactly the 25% edge", () => {
    expect(find(posted({ amountCents: -12_500 }))).toHaveLength(1);
  });

  it("raises a candidate at exactly the three-day edge, in either direction", () => {
    expect(find(posted({ txnDate: "2026-07-06" }))).toHaveLength(1);
    expect(find(posted({ txnDate: "2026-06-30" }))).toHaveLength(1);
  });
});

describe("findNearDuplicates — misses", () => {
  it("ignores a row more than three days away", () => {
    expect(find(posted({ txnDate: "2026-07-07" }))).toEqual([]);
  });

  it("ignores a row further than 25% from the amount", () => {
    expect(find(posted({ amountCents: -14_000 }))).toEqual([]);
  });

  it("ignores a refund against a charge, because the signs differ", () => {
    expect(find(posted({ amountCents: 11_500 }))).toEqual([]);
  });

  it("ignores rows on another account", () => {
    expect(find(posted(), [pending], "acct-chequing")).toEqual([]);
  });

  it("ignores the row's own exact duplicate, which is already flagged by the key", () => {
    expect(find(posted({ dedupeKey: PENDING_KEY }))).toEqual([]);
  });

  it("never merges — it only returns candidates", () => {
    const candidates = find(posted());
    expect(candidates[0].existingTransactionId).toBe("txn-pending");
    expect(candidates).toHaveLength(1);
  });
});
