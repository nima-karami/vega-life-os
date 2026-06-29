import { getCalendarToken } from "./google-auth";
import { getWriteCalendarId, setWriteCalendarId } from "./state";

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
  }));
}

/** Return the VEGA write-calendar id, creating it if the stored id is missing or gone. */
export async function ensureVegaCalendar(interactive = false): Promise<string> {
  const stored = getWriteCalendarId();
  if (stored) {
    const check = await api(`calendars/${encodeURIComponent(stored)}`, {}, interactive);
    if (check.ok) return stored;
    if (check.status !== 404 && check.status !== 410)
      throw new Error(`gcal calendars ${check.status}`);
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
