import {
  startOfQuarter, endOfQuarter, getQuarter,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear, getYear,
  format, parseISO,
} from "date-fns";

export type Timeframe = "quarter" | "month" | "year" | "custom";

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/** start/end ISO dates for a preset timeframe around a reference date. */
export function presetRange(tf: Exclude<Timeframe, "custom">, ref: Date = new Date()): { start: string; end: string } {
  if (tf === "quarter") return { start: fmt(startOfQuarter(ref)), end: fmt(endOfQuarter(ref)) };
  if (tf === "month") return { start: fmt(startOfMonth(ref)), end: fmt(endOfMonth(ref)) };
  return { start: fmt(startOfYear(ref)), end: fmt(endOfYear(ref)) };
}

/** Which preset (if any) a start/end pair exactly matches — for highlighting + labels. */
export function detectTimeframe(start: string, end: string): Timeframe {
  const s = parseISO(start);
  for (const tf of ["quarter", "month", "year"] as const) {
    const r = presetRange(tf, s);
    if (r.start === start && r.end === end) return tf;
  }
  return "custom";
}

/** Friendly period label: "Q2 2026" · "Jun 2026" · "2026" · "Jun 3 – Jul 13". */
export function periodLabel(start: string, end: string): string {
  const s = parseISO(start);
  const tf = detectTimeframe(start, end);
  if (tf === "quarter") return `Q${getQuarter(s)} ${getYear(s)}`;
  if (tf === "month") return format(s, "MMM yyyy");
  if (tf === "year") return String(getYear(s));
  return `${format(s, "MMM d")} – ${format(parseISO(end), "MMM d")}`;
}
