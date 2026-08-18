import { describe, expect, it } from "vitest";
import { groupTransactionsByDay } from "../ledger-grouping";
import { row } from "./fixtures";

describe("grouping the ledger by day", () => {
  it("groups rows onto their own date, newest date first", () => {
    const groups = groupTransactionsByDay([
      row("2026-08-04", -1000),
      row("2026-08-11", -2000),
      row("2026-08-09", -3000),
    ]);
    expect(groups.map((group) => group.date)).toEqual(["2026-08-11", "2026-08-09", "2026-08-04"]);
  });

  it("keeps every row under its day, in the order given", () => {
    const first = row("2026-08-11", -1000);
    const second = row("2026-08-11", -2000);
    const [group] = groupTransactionsByDay([first, second]);
    expect(group.rows).toEqual([first, second]);
  });

  it("sums the full charge and the owner's share for a normal shared day", () => {
    const [group] = groupTransactionsByDay([
      row("2026-08-11", -21311, { isHousehold: true, myShareBps: 6832 }),
    ]);
    expect(group.fullTotalCents).toBe(21311);
    // 21311 × 0.6832 = 14559.6752 → rounds to 14560.
    expect(group.shareTotalCents).toBe(14560);
    expect(group.unreviewedCount).toBe(0);
  });

  it("excludes a row with an unresolved flag from both totals, and counts it instead", () => {
    const clean = row("2026-08-11", -10000);
    const uncategorised = row("2026-08-11", -5000, { categoryId: null });
    const groups = groupTransactionsByDay([clean, uncategorised]);
    expect(groups[0].fullTotalCents).toBe(10000);
    expect(groups[0].shareTotalCents).toBe(10000);
    expect(groups[0].unreviewedCount).toBe(1);
    // The excluded row still renders — it is shown, just not summed.
    expect(groups[0].rows).toHaveLength(2);
  });

  it("lets a refund carry its sign, and a day can read net negative", () => {
    const spend = row("2026-08-11", -5000);
    const refund = row("2026-08-11", 11440);
    const [group] = groupTransactionsByDay([spend, refund]);
    expect(group.fullTotalCents).toBe(-6440);
    expect(group.shareTotalCents).toBe(-6440);
  });

  it("gives the share column only the first month's slice of a spread row, while full stays the whole charge", () => {
    const spread = row("2026-08-11", -120000, {
      spreadMonths: 12,
      isHousehold: true,
      myShareBps: 5000,
    });
    const [group] = groupTransactionsByDay([spread]);
    expect(group.fullTotalCents).toBe(120000);
    // Borne share is 60000 over 12 months; 60000/12 = 5000 exactly, first month included.
    expect(group.shareTotalCents).toBe(5000);
  });

  it("sums the day total from the same rounded per-row shares the row cells show, drift and all", () => {
    // Three rows each at 362.5¢ borne share round to 363 individually, so the day reads 1089 —
    // this deliberately differs from the once-rounded 1088 the settlement page reports for the
    // same rows, because the ledger's own column is built from what each row cell displays.
    const odd = () => row("2026-08-11", -725, { isHousehold: true, myShareBps: 5000 });
    const [group] = groupTransactionsByDay([odd(), odd(), odd()]);
    expect(group.shareTotalCents).toBe(1089);
  });

  it("accounts for every row given, either in a subtotal or in the unreviewed count", () => {
    const rows = [
      row("2026-08-02", -1000),
      row("2026-08-02", -2000, { categoryId: null }),
      row("2026-08-03", -3000),
    ];
    const groups = groupTransactionsByDay(rows);
    const summed = groups.reduce((count, group) => count + group.rows.length, 0);
    const excluded = groups.reduce((count, group) => count + group.unreviewedCount, 0);
    expect(summed).toBe(rows.length);
    expect(excluded).toBe(1);
    // The two counted rows are exactly the ones the subtotals add up.
    expect(groups.reduce((cents, group) => cents + group.fullTotalCents, 0)).toBe(4000);
  });

  it("reads no rows as no groups", () => {
    expect(groupTransactionsByDay([])).toEqual([]);
  });
});
