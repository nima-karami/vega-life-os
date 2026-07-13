import { useStore } from "@/core/store";
import { getCalendarToken } from "./google-auth";

const BASE = "https://www.googleapis.com/calendar/v3";
const VEGA_SUMMARY = "VEGA";

async function callApi(
  path: string,
  init: RequestInit = {},
  interactive = false,
): Promise<Response> {
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
  const response = await callApi("users/me/calendarList?minAccessRole=reader", {}, interactive);
  if (!response.ok) throw new Error(`gcal calendarList ${response.status}`);
  const payload = await response.json();
  return (payload.items ?? []).map((c: Record<string, unknown>) => ({
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
 *   3. otherwise create one — interactive flows only.
 * Finding by name first prevents duplicate "VEGA" calendars when connecting from a
 * new origin (the stored id lives in per-origin localStorage).
 */
export async function ensureVegaCalendar(interactive = false): Promise<string | null> {
  const setWriteCalendarId = (id: string) => useStore.getState().setGcalWriteCalendarId(id);
  const stored = useStore.getState().gcal.writeCalendarId;
  if (stored) {
    const check = await callApi(`calendars/${encodeURIComponent(stored)}`, {}, interactive);
    if (check.ok) return stored;
    if (check.status !== 404 && check.status !== 410)
      throw new Error(`gcal calendars ${check.status}`);
  }
  const existing = (await listCalendars(interactive)).find(isVegaCalendar);
  if (existing) {
    setWriteCalendarId(existing.id);
    return existing.id;
  }
  // Background must not silently recreate the VEGA calendar — pause & ask instead (Q3).
  if (!interactive) return null;
  const created = await callApi(
    "calendars",
    { method: "POST", body: JSON.stringify({ summary: VEGA_SUMMARY }) },
    interactive,
  );
  if (!created.ok) throw new Error(`gcal create calendar ${created.status}`);
  const id = (await created.json()).id as string;
  setWriteCalendarId(id);
  return id;
}

/** Delete the VEGA write-calendar from Google. Treats already-gone (404/410) as success. */
export async function deleteVegaCalendar(interactive = true): Promise<void> {
  const id = useStore.getState().gcal.writeCalendarId;
  if (!id) return;
  const response = await callApi(
    `calendars/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    interactive,
  );
  if (!response.ok && response.status !== 404 && response.status !== 410)
    throw new Error(`gcal delete calendar ${response.status}`);
  useStore.getState().setGcalWriteCalendarId(null);
}
