/**
 * Two money weights, and only two: the share is what the owner is accountable for and reads as
 * the figure; the charge is context beside it and never competes.
 */
export const SHARE_MONEY_CLASS = "text-[13.5px] font-medium text-foreground tabular-nums";

export const CHARGE_MONEY_CLASS = "text-[13px] font-normal text-muted tabular-nums";

const WHOLE_DOLLARS = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

/** Chart captions and the phone's budget list drop the cents — at that size they are noise. */
export const formatWholeDollars = (cents: number): string => WHOLE_DOLLARS.format(cents / 100);
