import { format, parseISO } from "date-fns";
import { FINANCE_DATE_FORMATS, type FinanceDateFormat } from "./types";

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const SLASHED_DATE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/;
const MONEY = /^([+-]?)(\d*)(?:\.(\d{1,2}))?$/;

export const isFinanceDateFormat = (value: string): value is FinanceDateFormat =>
  (FINANCE_DATE_FORMATS as readonly string[]).includes(value);

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const toISODate = (year: number, month: number, day: number): string | null => {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/**
 * Never infers the field order. `YYYY-MM-DD` input is accepted under any declared
 * format because its order is fixed — that is the one case with no DD/MM↔MM/DD risk.
 */
export function parseStatementDate(raw: string, dateFormat: FinanceDateFormat): string | null {
  const trimmed = raw.trim();
  const iso = ISO_DATE.exec(trimmed);
  if (iso) return toISODate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  if (dateFormat === "YYYY-MM-DD") return null;

  const slashed = SLASHED_DATE.exec(trimmed);
  if (!slashed) return null;
  const first = Number(slashed[1]);
  const second = Number(slashed[2]);
  const year = Number(slashed[3]);
  return dateFormat === "MM/DD/YYYY"
    ? toISODate(year, first, second)
    : toISODate(year, second, first);
}

export const formatDateLabel = (isoDate: string) => format(parseISO(isoDate), "d MMMM yyyy");

export const isBlankCell = (raw: string | undefined) => raw === undefined || raw.trim() === "";

/** Integer cents from a bank amount cell; `(38.40)`, `$1,234.56` and `−7.00` all read. */
export function parseAmountCents(raw: string): number | null {
  const bracketed = /^\((.*)\)$/.exec(raw.trim());
  const body = (bracketed ? bracketed[1] : raw).replace(/[$\s, ]/g, "").replace(/−/g, "-");
  const money = MONEY.exec(body);
  if (!money) return null;
  const whole = money[2];
  const fraction = money[3] ?? "";
  if (whole === "" && fraction === "") return null;
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0") || "0");
  const isNegative = money[1] === "-" || bracketed !== null;
  return isNegative ? -cents : cents;
}
