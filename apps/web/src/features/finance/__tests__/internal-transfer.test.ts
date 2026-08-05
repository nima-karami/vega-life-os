import { describe, expect, it } from "vitest";
import { detectInternalTransfer } from "../import/internal-transfer";

const isInternal = (description: string, amountCents = -100_000) =>
  detectInternalTransfer({ description, amountCents });

describe("detectInternalTransfer — card side", () => {
  it("flags a card payment however the bank punctuates it", () => {
    expect(isInternal("PAYMENT - THANK YOU", 120_000)).toBe(true);
    expect(isInternal("PAYMENT THANK YOU", 120_000)).toBe(true);
  });

  it("flags the French wording", () => {
    expect(isInternal("PAIEMENT - MERCI", 120_000)).toBe(true);
  });

  it("flags the issuer name only when it lands as a credit", () => {
    expect(isInternal("ROYAL BANK OF CANADA", 120_000)).toBe(true);
    expect(isInternal("ROYAL BANK OF CANADA", -120_000)).toBe(false);
  });
});

describe("detectInternalTransfer — bank side", () => {
  it("flags an online banking card payment", () => {
    expect(isInternal("Online Banking payment - 9012")).toBe(true);
  });

  it("flags an online banking transfer", () => {
    expect(isInternal("Online Banking transfer - 0000")).toBe(true);
  });

  it("flags a transfer to a deposit account with the digits glued on", () => {
    expect(isInternal("Online Transfer to Deposit Account-1234")).toBe(true);
  });

  it("flags both directions of a sent/received transfer", () => {
    expect(isInternal("Online transfer sent - 1111 to savings")).toBe(true);
    expect(isInternal("Online transfer received - 1111", 25_000)).toBe(true);
  });
});

describe("detectInternalTransfer — real spending stays out of it", () => {
  it("does not flag a merchant whose name merely contains payment", () => {
    expect(isInternal("SQUARE PAYMENT PROCESSING")).toBe(false);
  });

  it("does not flag an ordinary purchase", () => {
    expect(isInternal("PANTRYCO 1234 ANYTOWN ON")).toBe(false);
  });

  it("does not flag an e-transfer to a person", () => {
    expect(isInternal("INTERAC e-Transfer sent - ROBIN")).toBe(false);
  });
});
