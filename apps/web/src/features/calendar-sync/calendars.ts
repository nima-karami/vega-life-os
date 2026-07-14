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

/** True when this calendar is the VEGA write-calendar (the server pushes tasks to it). */
export const isVegaCalendar = (c: GCalendar): boolean =>
  c.summary === VEGA_SUMMARY && c.accessRole === "owner";
