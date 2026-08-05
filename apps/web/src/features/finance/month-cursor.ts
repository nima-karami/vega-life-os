import { addMonths, format, parseISO } from "date-fns";

const MONTH_KEY = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** The finance month key is `yyyy-MM`; anything else is a bad deep link, not an empty month. */
export const isMonthKey = (value: string): boolean => MONTH_KEY.test(value);

export const toMonthKey = (moment: Date): string => format(moment, "yyyy-MM");

export const shiftMonthKey = (month: string, delta: number): string =>
  toMonthKey(addMonths(parseISO(`${month}-01`), delta));

export const formatMonthLabel = (month: string): string =>
  format(parseISO(`${month}-01`), "MMMM yyyy");
