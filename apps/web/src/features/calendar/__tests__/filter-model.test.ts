import { describe, expect, it } from "vitest";
import type { GcalStatus } from "@/features/calendar-sync";
import type { Goal } from "@/features/goals";
import {
  ALL_FOCUS_ID,
  buildCalendarRows,
  buildFocusOptions,
  computeCalendarFilterBadgeCount,
  resolveFocusSelection,
} from "../filter-model";

const status = (over: Partial<GcalStatus> = {}): GcalStatus => ({
  connected: true,
  needsReauth: false,
  writeCalendarMissing: false,
  writeCalendarId: "cal_vega",
  readCalendarIds: ["primary", "work"],
  calendarPrefs: {
    primary: { visible: true, summary: "Primary", color: "#123456" },
    work: { visible: true, summary: "Work", color: null },
  },
  lastSyncedAt: null,
  backoffUntil: null,
  timeZone: null,
  ...over,
});

const goal = (id: string, name: string) => ({ id, name }) as Goal;

describe("computeCalendarFilterBadgeCount", () => {
  it("is zero when nothing is narrowed", () => {
    expect(computeCalendarFilterBadgeCount({ focusGoalId: null, gcalStatus: null })).toBe(0);
    expect(computeCalendarFilterBadgeCount({ focusGoalId: null, gcalStatus: status() })).toBe(0);
  });

  it("counts a focused goal as one", () => {
    expect(computeCalendarFilterBadgeCount({ focusGoalId: "g1", gcalStatus: null })).toBe(1);
  });

  it("counts each hidden read calendar", () => {
    const hidden = status({
      calendarPrefs: {
        primary: { visible: false, summary: "Primary", color: null },
        work: { visible: false, summary: "Work", color: null },
      },
    });
    expect(computeCalendarFilterBadgeCount({ focusGoalId: null, gcalStatus: hidden })).toBe(2);
  });

  it("sums focus and hidden calendars", () => {
    const hidden = status({
      calendarPrefs: { primary: { visible: false, summary: "Primary", color: null } },
    });
    expect(computeCalendarFilterBadgeCount({ focusGoalId: "g1", gcalStatus: hidden })).toBe(2);
  });

  it("treats a calendar with no stored pref as visible", () => {
    expect(
      computeCalendarFilterBadgeCount({
        focusGoalId: null,
        gcalStatus: status({ calendarPrefs: {} }),
      }),
    ).toBe(0);
  });

  it("ignores prefs for calendars that are not read calendars", () => {
    const stale = status({
      readCalendarIds: ["primary"],
      calendarPrefs: {
        primary: { visible: true, summary: "Primary", color: null },
        removed: { visible: false, summary: "Removed", color: null },
      },
    });
    expect(computeCalendarFilterBadgeCount({ focusGoalId: null, gcalStatus: stale })).toBe(0);
  });
});

describe("buildCalendarRows", () => {
  it("is empty when there is no status, no connection, or no read calendars", () => {
    expect(buildCalendarRows(null)).toEqual([]);
    expect(buildCalendarRows(status({ connected: false }))).toEqual([]);
    expect(buildCalendarRows(status({ readCalendarIds: [] }))).toEqual([]);
  });

  it("maps each read calendar to a row in order", () => {
    expect(buildCalendarRows(status())).toEqual([
      { id: "primary", summary: "Primary", color: "#123456", isVisible: true },
      { id: "work", summary: "Work", color: null, isVisible: true },
    ]);
  });

  it("falls back to the calendar id and visible-by-default when a pref is missing", () => {
    expect(buildCalendarRows(status({ readCalendarIds: ["solo"], calendarPrefs: {} }))).toEqual([
      { id: "solo", summary: "solo", color: null, isVisible: true },
    ]);
  });
});

describe("buildFocusOptions", () => {
  it("is empty when there are no focusable goals", () => {
    expect(buildFocusOptions([])).toEqual([]);
  });

  it("leads with an All row, then one row per goal", () => {
    expect(buildFocusOptions([goal("g1", "Run a 10k"), goal("g2", "Read 24 books")])).toEqual([
      { id: ALL_FOCUS_ID, label: "All" },
      { id: "g1", label: "Run a 10k" },
      { id: "g2", label: "Read 24 books" },
    ]);
  });
});

describe("resolveFocusSelection", () => {
  it("maps the All sentinel to no focus", () => {
    expect(resolveFocusSelection(ALL_FOCUS_ID)).toBeNull();
  });

  it("maps a goal id to that goal", () => {
    expect(resolveFocusSelection("g1")).toBe("g1");
  });
});
