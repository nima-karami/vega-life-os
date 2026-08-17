import { describe, expect, it } from "vitest";
import { describeShareSentence, describeSpreadRecognition } from "../transaction-detail-figures";
import { row } from "./fixtures";

describe("the share sentence", () => {
  it("bears the owner's share and sends the rest back, when the owner paid", () => {
    const figures = describeShareSentence(-12999, 8000, "me");
    expect(figures.youBearCents).toBe(10399);
    expect(figures.counterpartyCents).toBe(2600);
    expect(figures.direction).toBe("comes-back");
  });

  it("still bears the owner's share, but now owes it, when the partner paid", () => {
    const figures = describeShareSentence(-12999, 8000, "partner");
    expect(figures.youBearCents).toBe(10399);
    expect(figures.counterpartyCents).toBe(2600);
    expect(figures.direction).toBe("owed");
  });

  it("makes the pair sum to the full charge exactly, whatever the rounding", () => {
    const figures = describeShareSentence(-725, 6832, "me");
    expect(figures.youBearCents + figures.counterpartyCents).toBe(725);
  });

  it("reads a full share as nothing coming back", () => {
    const figures = describeShareSentence(-5000, 10000, "me");
    expect(figures.youBearCents).toBe(5000);
    expect(figures.counterpartyCents).toBe(0);
  });
});

describe("spread recognition", () => {
  it("lists every recognised month with the remainder on the first", () => {
    const txn = row("2026-03-10", -100000, { spreadMonths: 12 });
    const entries = describeSpreadRecognition(txn);
    expect(entries).toHaveLength(12);
    expect(entries[0]).toEqual({ month: "2026-03", cents: 8337 });
    expect(entries[1]).toEqual({ month: "2026-04", cents: 8333 });
    expect(entries.reduce((sum, entry) => sum + entry.cents, 0)).toBe(100000);
  });

  it("reads an unspread row as one month at the full share", () => {
    const txn = row("2026-03-10", -12000, { isHousehold: true, myShareBps: 5000 });
    expect(describeSpreadRecognition(txn)).toEqual([{ month: "2026-03", cents: 6000 }]);
  });
});
