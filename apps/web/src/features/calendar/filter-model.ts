import type { GcalStatus } from "@/features/calendar-sync";
import type { Goal } from "@/features/goals";

/** Sentinel row id for "no goal focused" — the store still holds `null`. */
export const ALL_FOCUS_ID = "all";

export interface CalendarVisibilityRow {
  id: string;
  summary: string;
  color: string | null;
  isVisible: boolean;
}

export interface FocusOption {
  id: string;
  label: string;
}

export function buildCalendarRows(gcalStatus: GcalStatus | null): CalendarVisibilityRow[] {
  if (!gcalStatus?.connected) return [];
  return gcalStatus.readCalendarIds.map((id) => {
    const pref = gcalStatus.calendarPrefs[id];
    return {
      id,
      summary: pref?.summary ?? id,
      color: pref?.color ?? null,
      isVisible: pref?.visible ?? true,
    };
  });
}

export function buildFocusOptions(focusableGoals: Goal[]): FocusOption[] {
  if (focusableGoals.length === 0) return [];
  return [
    { id: ALL_FOCUS_ID, label: "All" },
    ...focusableGoals.map((g) => ({ id: g.id, label: g.name })),
  ];
}

export const resolveFocusSelection = (id: string): string | null =>
  id === ALL_FOCUS_ID ? null : id;

export function computeCalendarFilterBadgeCount(input: {
  focusGoalId: string | null;
  gcalStatus: GcalStatus | null;
}): number {
  const hiddenCalendars = buildCalendarRows(input.gcalStatus).filter(
    (row) => !row.isVisible,
  ).length;
  return (input.focusGoalId ? 1 : 0) + hiddenCalendars;
}
