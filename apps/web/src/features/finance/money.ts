/**
 * Exact cent arithmetic. Share and amortization split cents into genuine fractions, so
 * every intermediate stays a bigint rational and only the final figure is rounded — per-row
 * rounding drifts, and no float ever touches money.
 */
export interface CentsFraction {
  numerator: bigint;
  denominator: bigint;
}

export const ZERO_CENTS: CentsFraction = { numerator: 0n, denominator: 1n };

const absolute = (value: bigint): bigint => (value < 0n ? -value : value);

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let current = absolute(left);
  let remainder = absolute(right);
  while (remainder !== 0n) {
    const next = current % remainder;
    current = remainder;
    remainder = next;
  }
  return current;
}

export function makeCentsFraction(numerator: bigint, denominator: bigint): CentsFraction {
  if (denominator === 0n) throw new RangeError("cents fraction denominator must not be zero");
  const signed = denominator < 0n ? -1n : 1n;
  const divisor = greatestCommonDivisor(numerator, denominator) || 1n;
  return {
    numerator: (numerator * signed) / divisor,
    denominator: (denominator * signed) / divisor,
  };
}

export const fromCents = (cents: number): CentsFraction => makeCentsFraction(BigInt(cents), 1n);

export function addCentsFractions(left: CentsFraction, right: CentsFraction): CentsFraction {
  const divisor = greatestCommonDivisor(left.denominator, right.denominator);
  const denominator = (left.denominator / divisor) * right.denominator;
  const numerator =
    left.numerator * (denominator / left.denominator) +
    right.numerator * (denominator / right.denominator);
  return makeCentsFraction(numerator, denominator);
}

export const subtractCentsFractions = (left: CentsFraction, right: CentsFraction): CentsFraction =>
  addCentsFractions(left, { numerator: -right.numerator, denominator: right.denominator });

export const scaleCentsFraction = (
  fraction: CentsFraction,
  numerator: bigint,
  denominator: bigint,
): CentsFraction =>
  makeCentsFraction(fraction.numerator * numerator, fraction.denominator * denominator);

const CANADIAN_DOLLARS = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

/** Display only — this is the one place a cent figure becomes a float, and it never flows back. */
export const formatCents = (cents: number): string => CANADIAN_DOLLARS.format(cents / 100);

/** Half-up away from zero, applied once, on the final figure (spec §3.6.5). */
export function roundToCents(fraction: CentsFraction): number {
  const magnitude =
    (2n * absolute(fraction.numerator) + fraction.denominator) / (2n * fraction.denominator);
  return Number(fraction.numerator < 0n ? -magnitude : magnitude);
}
