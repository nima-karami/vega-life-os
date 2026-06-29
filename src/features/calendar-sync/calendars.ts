import { useStore } from "@/core/store";
import { getCalendarToken } from "./google-auth";

const BASE = "https://www.googleapis.com/calendar/v3";
const VEGA_SUMMARY = "VEGA";

async function api(path: string, init: RequestInit = {}, interactive = false): Promise<Response> {
  const token = await getCalendarToken(interactive);
  return fetch(`${BASE}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export interface GCalendar {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
  /** "owner" | "writer" | "reader" | "freeBusyReader" */
  accessRole?: string;
}

/** The user's calendars (reader access or better). */
export async function listCalendars(interactive = false): Promise<GCalendar[]> {
  const res = await api("users/me/calendarList?minAccessRole=reader", {}, interactive);
  if (!res.ok) throw new Error(`gcal calendarList ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    summary: (c.summaryOverride as string) ?? (c.summary as string),
    backgroundColor: c.backgroundColor as string | undefined,
    primary: c.primary as boolean | undefined,
    accessRole: c.accessRole as string | undefined,
  }));
}

/** True when this calendar is the VEGA write-calendar (the one VEGA pushes tasks to). */
export const isVegaCalendar = (c: GCalendar): boolean =>
  c.summary === VEGA_SUMMARY && c.accessRole === "owner";

/**
 * Return the VEGA write-calendar id. Resolution order:
 *   1. a verified stored id (this origin),
 *   2. an existing owned calendar named "VEGA" (created from another origin/device),
 *   3. otherwise create one.
 * Finding by name first prevents duplicate "VEGA" calendars when connecting from a
 * new origin (the stored id lives in per-origin localStorage).
 */
export async function ensureVegaCalendar(interactive = false): Promise<string> {
  const setWriteCalendarId = (id: string) => useStore.getState().setGcalWriteCalendarId(id);
  const stored = useStore.getState().gcal.writeCalendarId;
  if (stored) {
    const check = await api(`calendars/${encodeURIComponent(stored)}`, {}, interactive);
    if (check.ok) return stored;
    if (check.status !== 404 && check.status !== 410)
      throw new Error(`gcal calendars ${check.status}`);
  }
  const existing = (await listCalendars(interactive)).find(isVegaCalendar);
  if (existing) {
    setWriteCalendarId(existing.id);
    return existing.id;
  }
  const created = await api(
    "calendars",
    { method: "POST", body: JSON.stringify({ summary: VEGA_SUMMARY }) },
    interactive,
  );
  if (!created.ok) throw new Error(`gcal create calendar ${created.status}`);
  const id = (await created.json()).id as string;
  setWriteCalendarId(id);
  return id;
}
