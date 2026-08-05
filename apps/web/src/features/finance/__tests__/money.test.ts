import { describe, expect, it } from "vitest";
import {
  addCentsFractions,
  computeShareFraction,
  formatCentsPlain,
  formatShareBps,
  fromCents,
  isSpreadMonths,
  makeCentsFraction,
  parseShareBps,
  parseSpreadMonths,
  roundToCents,
  scaleCentsFraction,
  subtractCentsFractions,
  ZERO_CENTS,
} from "../money";
import { parseAmountToCents } from "../quick-add-draft";

describe("roundToCents", () => {
  it("rounds a half away from zero, in both directions", () => {
    expect(roundToCents(makeCentsFraction(725n, 2n))).toBe(363);
    expect(roundToCents(makeCentsFraction(-725n, 2n))).toBe(-363);
  });

  it("leaves whole cents alone and rounds the rest to nearest", () => {
    expect(roundToCents(fromCents(1234))).toBe(1234);
    expect(roundToCents(makeCentsFraction(2174n, 3n))).toBe(725); // 724.67
    expect(roundToCents(makeCentsFraction(-2174n, 3n))).toBe(-725);
    expect(roundToCents(ZERO_CENTS)).toBe(0);
  });

  it("carries thirds of a cent without drift over a long accumulation", () => {
    let total = ZERO_CENTS;
    for (let step = 0; step < 3000; step++)
      total = addCentsFractions(total, makeCentsFraction(1n, 3n));
    expect(total).toEqual({ numerator: 1000n, denominator: 1n });
    expect(roundToCents(total)).toBe(1000);
  });
});

describe("cents fraction arithmetic", () => {
  it("adds unlike denominators exactly", () => {
    const twelfth = makeCentsFraction(1n, 12n);
    const sum = addCentsFractions(twelfth, makeCentsFraction(1n, 10n));
    expect(sum).toEqual({ numerator: 11n, denominator: 60n });
  });

  it("normalises the sign onto the numerator", () => {
    expect(makeCentsFraction(3n, -4n)).toEqual({ numerator: -3n, denominator: 4n });
  });

  it("subtracts and scales without losing the fraction", () => {
    const half = makeCentsFraction(725n, 2n);
    expect(subtractCentsFractions(fromCents(2175), half)).toEqual({
      numerator: 3625n,
      denominator: 2n,
    });
    expect(scaleCentsFraction(half, 31n, 2n)).toEqual({ numerator: 22475n, denominator: 4n });
  });

  it("refuses a zero denominator rather than producing a silent NaN", () => {
    expect(() => makeCentsFraction(1n, 0n)).toThrow(RangeError);
  });
});

describe("share parsing", () => {
  it("takes any percentage, not just the presets", () => {
    expect(parseShareBps("50")).toBe(5000);
    expect(parseShareBps("37.25")).toBe(3725);
    expect(parseShareBps("0")).toBe(0);
    expect(parseShareBps("100")).toBe(10000);
    expect(parseShareBps(" 12.5 ")).toBe(1250);
  });

  it("refuses a figure that is not a share", () => {
    expect(parseShareBps("")).toBeNull();
    expect(parseShareBps("101")).toBeNull();
    expect(parseShareBps("-1")).toBeNull();
    expect(parseShareBps("half")).toBeNull();
    // finer than a basis point would have to be rounded, and rounding is what corrupted the row
    expect(parseShareBps("50.005")).toBeNull();
  });

  it("names basis points without inventing precision", () => {
    expect(formatShareBps(3725)).toBe("37.25");
    expect(formatShareBps(6200)).toBe("62");
    expect(formatShareBps(6205)).toBe("62.05");
    expect(formatShareBps(5000)).toBe("50");
    expect(formatShareBps(10000)).toBe("100");
    expect(formatShareBps(0)).toBe("0");
  });
});

/**
 * The bug this pins: a private whole-percent pair in the review queue rendered a stored 6250 as
 * `63` and wrote back 6300. Every surface that shows a share now goes through this one pair.
 */
describe("a 62.5% row", () => {
  const SHARE_BPS = 6250;

  it("survives a round trip through the ledger, the review queue and the bulk bar", () => {
    const shown = formatShareBps(SHARE_BPS);
    expect(shown).toBe("62.5");
    expect(parseShareBps(shown)).toBe(SHARE_BPS);
    expect(parseShareBps(formatShareBps(parseShareBps(shown) ?? 0))).toBe(SHARE_BPS);
  });

  it("bears the exact cents its share says, with no float in the way", () => {
    expect(roundToCents(computeShareFraction(-3842, SHARE_BPS))).toBe(-2401);
    expect(computeShareFraction(1001, SHARE_BPS)).toEqual({ numerator: 5005n, denominator: 8n });
  });
});

describe("spread months", () => {
  it("keeps spread a whole number of months inside the allowed range", () => {
    expect(parseSpreadMonths("12")).toBe(12);
    expect(parseSpreadMonths("1")).toBe(1);
    expect(parseSpreadMonths("0")).toBeNull();
    expect(parseSpreadMonths("37")).toBeNull();
    expect(parseSpreadMonths("1.5")).toBeNull();
    expect(parseSpreadMonths("")).toBeNull();
  });

  it("answers the same question of a number the stepper already holds", () => {
    expect(isSpreadMonths(36)).toBe(true);
    expect(isSpreadMonths(37)).toBe(false);
    expect(isSpreadMonths(0)).toBe(false);
  });
});

describe("plain cents", () => {
  it("undresses a figure for an amount field, and reads back as the same cents", () => {
    expect(formatCentsPlain(95700)).toBe("957.00");
    expect(formatCentsPlain(5)).toBe("0.05");
    expect(formatCentsPlain(-1234)).toBe("-12.34");
    expect(parseAmountToCents(formatCentsPlain(95700))).toBe(95700);
  });
});
