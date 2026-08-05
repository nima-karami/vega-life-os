import { describe, expect, it } from "vitest";
import { parseRecord } from "../collection-store";

const transaction = (overrides: Record<string, unknown> = {}) => ({
  id: "ftxn_1",
  dedupeKey: null,
  accountId: null,
  txnDate: "2026-08-04",
  description: "Green Market",
  amountCents: -4210,
  originalAmountCents: null,
  originalCurrency: null,
  categoryId: null,
  merchantId: null,
  payer: "me",
  source: "manual",
  enteredBy: "me",
  importBatchId: null,
  sourceRowNumber: null,
  refundOfTransactionId: null,
  note: "",
  createdAt: "2026-08-04",
  ...overrides,
});

const parseTransaction = (overrides: Record<string, unknown>) => () =>
  parseRecord("financeTransactions", transaction(overrides));

const settlement = (status: string) => ({
  id: "2026-08",
  month: "2026-08",
  status,
  settledBalanceCents: null,
  settledAt: null,
  paidCents: null,
  paidAt: null,
  paymentTransactionId: null,
  note: "",
});

describe("a finance transaction reaching the server", () => {
  it("fills the share and spread defaults a client omitted", () => {
    expect(parseRecord("financeTransactions", transaction())).toMatchObject({
      myShareBps: 10000,
      spreadMonths: 1,
    });
  });

  it("keeps both ends of each range", () => {
    expect(
      parseRecord("financeTransactions", transaction({ myShareBps: 0, spreadMonths: 36 })),
    ).toMatchObject({ myShareBps: 0, spreadMonths: 36 });
  });

  it("rejects a share outside 0–10000 basis points", () => {
    for (const myShareBps of [-1, 10001, 999999, 5000.5]) {
      expect(parseTransaction({ myShareBps })).toThrow();
    }
  });

  it("rejects a spread outside 1–36 whole months", () => {
    for (const spreadMonths of [0, -1, 37, 2.5]) {
      expect(parseTransaction({ spreadMonths })).toThrow();
    }
  });
});

describe("a finance settlement reaching the server", () => {
  it("stores the two statuses a write path can produce", () => {
    for (const status of ["open", "settled"]) {
      expect(parseRecord("financeSettlements", settlement(status))).toMatchObject({ status });
    }
  });

  it("rejects the amended status, which is derived on screen and never stored", () => {
    expect(() => parseRecord("financeSettlements", settlement("amended"))).toThrow();
  });
});
