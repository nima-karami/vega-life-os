import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../events-model";
import type { GEvent } from "../map";
import { dedupeForDisplay, reconcileLived } from "../reconcile-lived";

const base = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "ce_1",
  googleId: "g1",
  iCalUID: "u1",
  calendarId: "cal",
  title: "Show",
  date: "2026-07-11",
  time: "17:00",
  durationMin: 180,
  allDay: false,
  recurringEventId: null,
  googleUpdated: "2026-06-20T10:00:00Z",
  status: "confirmed",
  responseStatus: "accepted",
  valueId: null,
  goalId: null,
  note: "",
  vegaEditedAt: null,
  pendingDelete: false,
  removedAt: null,
  ...over,
});

// Fixtures run under TZ=UTC, so a UTC dateTime maps to the same wall clock.
const g = (over: Partial<GEvent>): GEvent => ({
  id: "g1",
  iCalUID: "u1",
  summary: "Show",
  status: "confirmed",
  start: { dateTime: "2026-07-11T17:00:00Z" },
  end: { dateTime: "2026-07-11T20:00:00Z" },
  updated: "2026-06-20T10:00:00Z",
  ...over,
});

describe("reconcileLived — insert / skip", () => {
  it("inserts a new external event with no meaning", () => {
    const { upserts, dropIds } = reconcileLived([], [g({})], "cal", "2026-07-01");
    expect(dropIds).toEqual([]);
    expect(upserts[0]).toMatchObject({ googleId: "g1", valueId: null, title: "Show" });
    expect(upserts[0].id).toMatch(/^ce_/);
  });
  it("skips VEGA-originated events (vegaTaskId tag) — task lane owns them", () => {
    const ev = g({ extendedProperties: { private: { vegaTaskId: "t_1" } } });
    expect(reconcileLived([], [ev], "cal", "2026-07-01").upserts).toEqual([]);
  });
});

describe("reconcileLived — update / conflict", () => {
  it("Google wins when there is no pending local edit", () => {
    const existing = base({ time: "17:00" });
    const moved = g({
      start: { dateTime: "2026-07-11T18:00:00Z" },
      updated: "2026-06-21T10:00:00Z",
    });
    const e = reconcileLived([existing], [moved], "cal", "2026-07-01").upserts[0];
    expect(e.time).toBe("18:00");
    expect(e.id).toBe("ce_1"); // identity preserved
  });
  it("keeps the value tag across a Google-wins update", () => {
    const existing = base({ valueId: "v_presence", note: "with her" });
    const moved = g({ updated: "2026-06-22T10:00:00Z", summary: "Date (moved)" });
    const e = reconcileLived([existing], [moved], "cal", "2026-07-01").upserts[0];
    expect(e).toMatchObject({ valueId: "v_presence", note: "with her", title: "Date (moved)" });
  });
  it("local edit wins when newer than Google's update", () => {
    const existing = base({ time: "19:30", vegaEditedAt: "2026-06-25T00:00:00Z" });
    const stale = g({
      updated: "2026-06-20T10:00:00Z",
      start: { dateTime: "2026-07-11T17:00:00Z" },
    });
    const e = reconcileLived([existing], [stale], "cal", "2026-07-01").upserts[0];
    expect(e.time).toBe("19:30"); // local pending edit retained
    expect(e.vegaEditedAt).toBe("2026-06-25T00:00:00Z");
  });
  it("Google wins over a stale local edit and clears the pending flag", () => {
    const existing = base({ time: "19:30", vegaEditedAt: "2026-06-19T00:00:00Z" });
    const newer = g({
      updated: "2026-06-26T10:00:00Z",
      start: { dateTime: "2026-07-11T19:00:00Z" },
    });
    const e = reconcileLived([existing], [newer], "cal", "2026-07-01").upserts[0];
    expect(e.time).toBe("19:00");
    expect(e.vegaEditedAt).toBeNull();
  });
});

describe("reconcileLived — removal rules", () => {
  it("drops an untagged event cancelled in Google", () => {
    const existing = base({ valueId: null });
    const r = reconcileLived([existing], [g({ status: "cancelled" })], "cal", "2026-07-10");
    expect(r.dropIds).toEqual(["ce_1"]);
  });
  it("retains a tagged PAST event removed in Google as history", () => {
    const existing = base({ valueId: "v_presence", date: "2026-06-01" });
    const r = reconcileLived([existing], [g({ status: "cancelled" })], "cal", "2026-07-10");
    expect(r.dropIds).toEqual([]);
    expect(r.upserts[0]).toMatchObject({ removedAt: expect.any(String), valueId: "v_presence" });
  });
  it("marks a tagged FUTURE event removed (kept, flagged) for a keep/discard prompt", () => {
    const existing = base({ valueId: "v_presence", date: "2026-08-01" });
    const r = reconcileLived([existing], [g({ status: "cancelled" })], "cal", "2026-07-10");
    expect(r.upserts[0]).toMatchObject({ removedAt: expect.any(String) });
  });
});

describe("dedupeForDisplay", () => {
  it("collapses two calendar copies of one invite to a single row", () => {
    const a = base({ id: "ce_a", googleId: "ga", calendarId: "cal_personal", iCalUID: "shared" });
    const b = base({ id: "ce_b", googleId: "gb", calendarId: "cal_work", iCalUID: "shared" });
    expect(dedupeForDisplay([a, b])).toHaveLength(1);
  });
  it("hides a declined event unless it carries a value tag", () => {
    const declined = base({ responseStatus: "declined", valueId: null });
    const declinedTagged = base({
      id: "ce_2",
      iCalUID: "u2",
      responseStatus: "declined",
      valueId: "v_x",
    });
    expect(dedupeForDisplay([declined])).toHaveLength(0);
    expect(dedupeForDisplay([declinedTagged])).toHaveLength(1);
  });
  it("hides events removed in Google but keeps tagged history out of the live grid", () => {
    const removed = base({ removedAt: "2026-07-10T00:00:00Z", valueId: "v_x" });
    expect(dedupeForDisplay([removed])).toHaveLength(0);
  });
  it("hides an event queued for deletion (optimistic removal)", () => {
    expect(dedupeForDisplay([base({ pendingDelete: true })])).toHaveLength(0);
  });
});
