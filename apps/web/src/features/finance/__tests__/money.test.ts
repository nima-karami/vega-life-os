import { describe, expect, it } from "vitest";
import {
  addCentsFractions,
  fromCents,
  makeCentsFraction,
  roundToCents,
  scaleCentsFraction,
  subtractCentsFractions,
  ZERO_CENTS,
} from "../money";

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
