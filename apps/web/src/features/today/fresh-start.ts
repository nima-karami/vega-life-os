import { dowIndex, isValidISODate } from "@/core/lib/date";

// Per device on purpose: the card is a nudge, not a record worth syncing.
const KEY = "vega.freshStartDismissedFor";

let sessionDismissedFor: string | null = null;

export function shouldShowFreshStart(
  today: string,
  viewDate: string,
  dismissedFor: string | null,
): boolean {
  return viewDate === today && dowIndex(today) === 0 && dismissedFor !== today;
}

function readStoredDismissal(): string | null {
  try {
    const stored = localStorage.getItem(KEY);
    return isValidISODate(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function readFreshStartDismissal(): string | null {
  return sessionDismissedFor ?? readStoredDismissal();
}

export function dismissFreshStart(weekStart: string): void {
  sessionDismissedFor = weekStart;
  try {
    localStorage.setItem(KEY, weekStart);
  } catch {
    /* the session copy above keeps it dismissed */
  }
}
