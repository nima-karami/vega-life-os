import { addMonths, format, parseISO } from "date-fns";

const MONTH_KEY = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const LEADING_MONTH = /^\d{4}-(?:0[1-9]|1[0-2])-/;

/** The finance month key is `yyyy-MM`; anything else is a bad deep link, not an empty month. */
export const isMonthKey = (value: string): boolean => MONTH_KEY.test(value);

export const toMonthKey = (moment: Date): string => format(moment, "yyyy-MM");

/**
 * An ISO date already opens with its month, and this runs per row per render — round-tripping it
 * through `parseISO` costs ~100×. An unreadable date still throws, so a card reports a failure
 * rather than quietly leaving the row out of the month's total.
 */
export function monthOfISO(isoDate: string): string {
  if (!LEADING_MONTH.test(isoDate)) throw new RangeError(`not an ISO date: ${isoDate}`);
  return isoDate.slice(0, 7);
}

export const shiftMonthKey = (month: string, delta: number): string =>
  toMonthKey(addMonths(parseISO(`${month}-01`), delta));

export const formatMonthLabel = (month: string): string =>
  format(parseISO(`${month}-01`), "MMMM yyyy");
