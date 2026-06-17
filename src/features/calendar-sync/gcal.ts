import { getCalendarToken } from "./google-auth";
import type { GEvent } from "./map";

const BASE = "https://www.googleapis.com/calendar/v3/calendars";

async function call(path: string, init: RequestInit = {}, interactive = false): Promise<Response> {
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

/** List events VEGA created (tagged with vegaTaskId), incrementally when possible. */
export async function listVegaEvents(
  calendarId: string,
  syncToken: string | null,
  interactive = false,
): Promise<{ events: GEvent[]; nextSyncToken: string | null; expired: boolean }> {
  const cal = encodeURIComponent(calendarId);
  const events: GEvent[] = [];
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  do {
    const params = new URLSearchParams({ showDeleted: "true", maxResults: "250" });
    if (syncToken) params.set("syncToken", syncToken);
    else params.set("privateExtendedProperty", "vegaTaskId=*"); // initial full sync: only our events
    if (pageToken) params.set("pageToken", pageToken);
    const res = await call(`${cal}/events?${params}`, {}, interactive);
    if (res.status === 410) return { events: [], nextSyncToken: null, expired: true }; // token expired → full resync
    if (!res.ok) throw new Error(`gcal list ${res.status}`);
    const data = await res.json();
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken ?? null;
    nextSyncToken = data.nextSyncToken ?? nextSyncToken;
  } while (pageToken);
  return { events, nextSyncToken, expired: false };
}

export async function insertEvent(calendarId: string, body: GEvent): Promise<GEvent> {
  const res = await call(`${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gcal insert ${res.status}`);
  return res.json();
}

export async function patchEvent(calendarId: string, eventId: string, body: GEvent): Promise<void> {
  const res = await call(`${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gcal patch ${res.status}`);
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const res = await call(`${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 410 && res.status !== 404)
    throw new Error(`gcal delete ${res.status}`);
}
