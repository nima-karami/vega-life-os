// Device-local sync state only. Per-calendar incremental cursors and the granted
// scope version are inherently per-device (a sync token is a per-consumer cursor into
// Google's change stream), so they stay in localStorage. User-level connection config
// (enabled / read+write calendars / show-events) lives in the cloud profile — see config.ts.

const TOKEN = (cal: string) => `vega.gcal.syncToken.${cal}`;
const SCOPE = "vega.gcal.scopeVersion";
const LAST_SYNCED = "vega.gcal.lastSyncedAt";
const SPAN_BACKFILL = "vega.gcal.spanBackfill.v1";

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export const getSyncToken = (cal: string): string | null => read(TOKEN(cal));
export const setSyncToken = (cal: string, v: string | null) => write(TOKEN(cal), v);

export const clearAllSyncTokens = () => {
  try {
    const prefix = TOKEN("");
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
};

export const getScopeVersion = () => Number(read(SCOPE) ?? "0");
export const setScopeVersion = (n: number) => write(SCOPE, String(n));

/**
 * One-time on this device: drop the per-calendar sync cursors so the next pull is a
 * FULL re-list, which re-maps every event through gEventToCalendarEvent and backfills
 * `endDate` onto events imported before multi-day support existed (the original end
 * was discarded, so it can only come from a fresh fetch). Idempotent after the first run.
 */
export function ensureSpanBackfill(): void {
  if (read(SPAN_BACKFILL) === "1") return;
  clearAllSyncTokens();
  write(SPAN_BACKFILL, "1");
}

/** Last successful sync time (ms epoch), persisted so the hint survives a reload. */
export const getLastSyncedAt = (): number | null => {
  const v = read(LAST_SYNCED);
  return v == null ? null : Number(v);
};
export const setLastSyncedAt = (ts: number) => write(LAST_SYNCED, String(ts));

/** Rolling sync horizon (days back / forward) bounding each tokenless full list. */
export const getWindow = () => ({ backDays: 28, fwdDays: 56 });
