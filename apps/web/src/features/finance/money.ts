/**
 * Exact cent arithmetic, and the share/spread vocabulary built on it. Share and amortization split
 * cents into genuine fractions, so every intermediate stays a bigint rational and only the final
 * figure is rounded — per-row rounding drifts, and no float ever touches money.
 */
export interface CentsFraction {
  numerator: bigint;
  denominator: bigint;
}

export const ZERO_CENTS: CentsFraction = { numerator: 0n, denominator: 1n };

export const FULL_SHARE_BPS = 10000;
export const HOUSEHOLD_DEFAULT_BPS = 5000;
const BPS_SCALE = BigInt(FULL_SHARE_BPS);
export const MIN_SPREAD_MONTHS = 1;
export const MAX_SPREAD_MONTHS = 36;

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

/** The one place a share is applied: an unrounded fraction the caller rounds once, at the end. */
export const computeShareFraction = (cents: number, shareBps: number): CentsFraction =>
  makeCentsFraction(BigInt(cents) * BigInt(shareBps), BPS_SCALE);

const CANADIAN_DOLLARS = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

/** Display only — this is the one place a cent figure becomes a float, and it never flows back. */
export const formatCents = (cents: number): string => CANADIAN_DOLLARS.format(cents / 100);

/** The same figure undressed, for an amount field the owner edits: `1234.56`, no symbol. */
export function formatCentsPlain(cents: number): string {
  const rounded = Math.round(cents);
  const magnitude = Math.abs(rounded);
  const hundredths = magnitude % 100;
  const dollars = (magnitude - hundredths) / 100;
  return `${rounded < 0 ? "-" : ""}${dollars}.${String(hundredths).padStart(2, "0")}`;
}

/** Half-up away from zero, applied once, on the final figure (spec §3.6.5). */
export function roundToCents(fraction: CentsFraction): number {
  const magnitude =
    (2n * absolute(fraction.numerator) + fraction.denominator) / (2n * fraction.denominator);
  return Number(fraction.numerator < 0n ? -magnitude : magnitude);
}

const PERCENT_INPUT = /^(\d*)(?:\.(\d*))?$/;

/**
 * Any percentage, not a preset list. It has to survive as exactly the basis points typed, so it
 * is read digit by digit with no float to round it, and refused outright below a basis point.
 */
export function parseShareBps(input: string): number | null {
  const match = PERCENT_INPUT.exec(input.trim());
  if (!match) return null;
  const whole = match[1] ?? "";
  const hundredths = match[2] ?? "";
  if (whole === "" && hundredths === "") return null;
  if (hundredths.length > 2) return null;
  const bps = Number(`${whole || "0"}${hundredths.padEnd(2, "0")}`);
  return bps > FULL_SHARE_BPS ? null : bps;
}

/** The inverse: 6250 reads `62.5`, 6200 reads `62`, 5000 reads `50`. */
export function formatShareBps(bps: number): string {
  const rounded = Math.round(bps);
  const hundredths = rounded % 100;
  const percent = (rounded - hundredths) / 100;
  if (hundredths === 0) return String(percent);
  return `${percent}.${String(hundredths).padStart(2, "0").replace(/0$/, "")}`;
}

export const isSpreadMonths = (months: number): boolean =>
  Number.isInteger(months) && months >= MIN_SPREAD_MONTHS && months <= MAX_SPREAD_MONTHS;

export function parseSpreadMonths(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const months = Number(trimmed);
  return isSpreadMonths(months) ? months : null;
}
