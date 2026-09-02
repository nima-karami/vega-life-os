/**
 * Two money weights, and only two: the share is what the owner is accountable for and reads as
 * the figure; the charge is context beside it and never competes.
 */
const SHARE_MONEY_WEIGHT = "text-[13.5px] font-medium tabular-nums";

const CHARGE_MONEY_WEIGHT = "text-[13px] font-normal tabular-nums";

export const SHARE_MONEY_CLASS = `${SHARE_MONEY_WEIGHT} text-foreground`;

export const CHARGE_MONEY_CLASS = `${CHARGE_MONEY_WEIGHT} text-muted`;

/** `cx` is plain clsx, so money-in has to replace the weight's colour instead of stacking on it. */
export const moneyInClass = (weight: "share" | "charge"): string =>
  `${weight === "share" ? SHARE_MONEY_WEIGHT : CHARGE_MONEY_WEIGHT} text-success`;

const WHOLE_DOLLARS = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

/** Chart captions and the phone's budget list drop the cents — at that size they are noise. */
export const formatWholeDollars = (cents: number): string => WHOLE_DOLLARS.format(cents / 100);
