import { format, lastDayOfMonth, parseISO } from "date-fns";
import type { IconName } from "@/core/lib/icon-names";
import { formatCents } from "./money";
import { formatMonthLabel } from "./month-cursor";
import type { SettlementFigures } from "./settlement";

const DEFAULT_PARTNER_NAME = "Partner";

/** Finance holds no name of its own — every occurrence reads Settings and falls back to `Partner`. */
export const resolvePartnerName = (partnerName: string): string =>
  partnerName.trim() === "" ? DEFAULT_PARTNER_NAME : partnerName.trim();

/**
 * The one rule the screen keeps repeating, because the budget side amortises and this side does
 * not: a spread row settles on its whole charge, in the month the money actually left.
 */
export const SPREAD_RULE =
  "Spread rows settle on the full charge, once, in the month they were paid.";

const countRows = (count: number): string => `${count} ${count === 1 ? "row" : "rows"}`;

const formatDayLabel = (isoDate: string): string => format(parseISO(isoDate), "MMM d");

const OPEN_PERIOD_WORDS = ["No open period", "One open period"] as const;

/** The header's sub-line: how many periods are still open, and how big the shown one is. */
export function describeSettlementSubLine(
  openPeriodCount: number,
  householdRowCount: number,
  month: string,
): string {
  const periods = OPEN_PERIOD_WORDS[openPeriodCount] ?? `${openPeriodCount} open periods`;
  const monthName = format(parseISO(`${month}-01`), "MMMM");
  return `${periods} · ${householdRowCount} shared ${householdRowCount === 1 ? "row" : "rows"} in ${monthName}`;
}

/** The line beside the status dot: what the period is, and the date that closes or closed it. */
export function describePeriodStatus(figures: SettlementFigures): string {
  const label = formatMonthLabel(figures.month);
  if (figures.phase === "open") {
    const closesOn = format(lastDayOfMonth(parseISO(`${figures.month}-01`)), "MMM d");
    return `${label} · open until ${closesOn}`;
  }
  const settledOn = figures.settledAt === null ? "" : ` ${formatDayLabel(figures.settledAt)}`;
  if (figures.phase === "amended") return `${label} · amended since it settled${settledOn}`;
  return `${label} · settled${settledOn}`;
}

/**
 * What the headline figure is built from, and what is still waiting on a split. Settlement counts
 * every household row at its current split, so a waiting row is named rather than deducted — the
 * sentence says which of the two it is instead of leaving the reader to assume.
 */
export function describeSettlementScope(figures: SettlementFigures): string {
  const netted = `${formatCents(figures.householdTotalCents)} of shared purchases netted across ${countRows(figures.householdRowCount)}`;
  if (figures.excludedCount === 0) return `${netted}.`;
  const verb = figures.excludedCount === 1 ? "waits" : "wait";
  return `${netted} · ${figures.excludedCount} of them, worth ${formatCents(figures.excludedCents)}, still ${verb} on a split.`;
}

/**
 * The rows-card footer. A waiting row prints no figure of its own, so the sentence says outright
 * that the net beside it still counts that row — otherwise the column would not add up by eye.
 */
export function describeRowsFooter(figures: SettlementFigures): string {
  const counted = `${countRows(figures.householdRowCount)} counted`;
  if (figures.excludedCount === 0) return counted;
  return `${counted} · ${figures.excludedCount} waiting on a split, counted in this net`;
}

export const describeFixRowsLabel = (excludedCount: number): string =>
  excludedCount === 1 ? "Fix the row" : `Fix the ${excludedCount} rows`;

export interface SettlementNote {
  icon: IconName;
  text: string;
  /** Amber and first: something the owner should deal with before the figure is agreed. */
  isBlocking: boolean;
}

const describeMissingSplitNote = (figures: SettlementFigures): SettlementNote => ({
  icon: "alert",
  text: `${countRows(figures.excludedCount)} still ${figures.excludedCount === 1 ? "has" : "have"} no split — ${formatCents(figures.excludedCents)} counts at its current split until you set one.`,
  isBlocking: true,
});

const describeAmendedNote = (figures: SettlementFigures): SettlementNote => ({
  icon: "alert",
  text: `The figure moved to ${formatCents(Math.abs(figures.currentBalanceCents))} after this period settled — a difference of ${formatCents(Math.abs(figures.differenceCents))}. Re-settle at the new figure, or carry the difference forward.`,
  isBlocking: true,
});

const describeSettledNote = (figures: SettlementFigures, frozenCents: number): SettlementNote => ({
  icon: "check",
  text: `Settled at ${formatCents(Math.abs(frozenCents))}${figures.settledAt === null ? "" : ` on ${formatDayLabel(figures.settledAt)}`} — later edits amend the period, they never rewrite that figure.`,
  isBlocking: false,
});

const describePaymentNote = (figures: SettlementFigures): SettlementNote => ({
  icon: "banknote",
  text: `${formatCents(Math.abs(figures.paymentCents))} recorded as paid${figures.paidAt === null ? "" : ` on ${formatDayLabel(figures.paidAt)}`}.`,
  isBlocking: false,
});

const describeCarriedNote = (figures: SettlementFigures): SettlementNote => ({
  icon: "send",
  text: `The rows since moved to ${formatCents(Math.abs(figures.currentBalanceCents))}; the ${formatCents(Math.abs(figures.differenceCents))} difference has been carried forward.`,
  isBlocking: false,
});

/**
 * The column beside the action: what blocks the settle, then what has already happened to this
 * period, and last the standing rule about spread rows — a blocker is useless anywhere else.
 */
export function listSettlementNotes(figures: SettlementFigures): SettlementNote[] {
  const notes: SettlementNote[] = [];
  if (figures.phase === "amended") notes.push(describeAmendedNote(figures));
  if (figures.excludedCount > 0) notes.push(describeMissingSplitNote(figures));
  if (figures.frozenBalanceCents !== null)
    notes.push(describeSettledNote(figures, figures.frozenBalanceCents));
  if (figures.paymentCents !== 0) notes.push(describePaymentNote(figures));
  if (figures.phase === "settled" && figures.differenceCents !== 0)
    notes.push(describeCarriedNote(figures));
  notes.push({ icon: "calendar-range", text: SPREAD_RULE, isBlocking: false });
  return notes;
}

export interface SettlementOutcome {
  /** The sentence up to the figure, so the history row can bold the figure alone. */
  lead: string;
  amount: string;
}

/** A closed period's outcome, in words — a bare minus sign is easy to misread. */
export function describeSettlementOutcome(
  balanceCents: number,
  partnerName: string,
): SettlementOutcome {
  const partner = resolvePartnerName(partnerName);
  if (balanceCents > 0) return { lead: `${partner} sent you`, amount: formatCents(balanceCents) };
  if (balanceCents < 0) return { lead: `You sent ${partner}`, amount: formatCents(-balanceCents) };
  return { lead: "Square — nothing changed hands", amount: "" };
}
