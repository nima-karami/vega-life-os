import { describe, expect, it } from "vitest";
import { daysBetween, shiftISO } from "@/core/lib/date";
import {
  findNearDuplicates,
  NEAR_DUPLICATE_DAY_WINDOW,
  type NearDuplicateRow,
} from "../import/near-duplicate";
import type { NearDuplicateCandidate, NearDuplicateSubject } from "../import/types";

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

const TOLERANCE_DIVISOR = 4;

const isPairNear = (row: NearDuplicateRow, subject: NearDuplicateSubject) => {
  if (subject.dedupeKey === row.dedupeKey) return false;
  if (Math.abs(daysBetween(row.txnDate, subject.txnDate)) > NEAR_DUPLICATE_DAY_WINDOW) return false;
  const spread = Math.abs(row.amountCents - subject.amountCents) * TOLERANCE_DIVISOR;
  const largest = Math.max(Math.abs(row.amountCents), Math.abs(subject.amountCents));
  return row.amountCents * subject.amountCents > 0 && spread <= largest;
};

/** The unbucketed cross product the bucketed scan replaced, kept here as the oracle. */
const scanEveryPair = (
  rows: readonly NearDuplicateRow[],
  existing: readonly NearDuplicateSubject[],
  accountId: string,
): NearDuplicateCandidate[] =>
  rows.flatMap((row) =>
    existing
      .filter((subject) => subject.accountId === accountId && isPairNear(row, subject))
      .map((subject) => ({
        sourceRowNumber: row.sourceRowNumber,
        existingTransactionId: subject.id,
        dayGap: daysBetween(row.txnDate, subject.txnDate),
        amountDeltaCents: row.amountCents - subject.amountCents,
      })),
  );

const ROW_KEY = "cccccccccccccccc:0";

const edgeRows: NearDuplicateRow[] = [
  { sourceRowNumber: 2, txnDate: "2026-07-05", amountCents: -3_000, dedupeKey: ROW_KEY },
  {
    sourceRowNumber: 3,
    txnDate: "2026-07-05",
    amountCents: -4_000,
    dedupeKey: "dddddddddddddddd:0",
  },
];

const subject = (
  id: string,
  txnDate: string,
  amountCents: number,
  overrides: Partial<NearDuplicateSubject> = {},
): NearDuplicateSubject => ({
  id,
  accountId: "acct-card",
  txnDate,
  amountCents,
  dedupeKey: `key-${id}`,
  ...overrides,
});

const edgeLedger: NearDuplicateSubject[] = [
  subject("three-days-earlier", "2026-07-02", -3_000),
  subject("four-days-earlier", "2026-07-01", -3_000),
  subject("three-days-later", "2026-07-08", -3_000),
  subject("four-days-later", "2026-07-09", -3_000),
  subject("tolerance-edge", "2026-07-05", -4_000),
  subject("tolerance-miss", "2026-07-05", -4_001),
  subject("opposite-sign", "2026-07-05", 3_000),
  subject("same-key", "2026-07-04", -3_000, { dedupeKey: ROW_KEY }),
  subject("other-account", "2026-07-05", -3_000, { accountId: "acct-chequing" }),
  subject("unassigned-account", "2026-07-05", -3_000, { accountId: null }),
];

const distantLedger = (count: number): NearDuplicateSubject[] =>
  Array.from({ length: count }, (_, index) =>
    subject(`distant-${index}`, shiftISO("2000-01-01", index), -3_000),
  );

describe("findNearDuplicates — bucketed scan", () => {
  it("selects exactly what a full cross product selects, edges included", () => {
    expect(findNearDuplicates(edgeRows, edgeLedger, "acct-card")).toEqual(
      scanEveryPair(edgeRows, edgeLedger, "acct-card"),
    );
  });

  it("keeps the day window closed at four days and the tolerance closed at one cent", () => {
    const matched = findNearDuplicates(edgeRows, edgeLedger, "acct-card")
      .filter((candidate) => candidate.sourceRowNumber === 2)
      .map((candidate) => candidate.existingTransactionId);
    expect(matched).toEqual(["three-days-earlier", "three-days-later", "tolerance-edge"]);
  });

  it("returns the same candidates however large the surrounding ledger is", () => {
    const small = findNearDuplicates(edgeRows, edgeLedger, "acct-card");
    const padded = [...distantLedger(50), ...edgeLedger, ...distantLedger(5_000)];
    expect(findNearDuplicates(edgeRows, padded, "acct-card")).toEqual(small);
  });
});
