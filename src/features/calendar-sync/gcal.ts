import { getCalendarToken } from "./google-auth";
import type { GEvent } from "./map";

const BASE = "https://www.googleapis.com/calendar/v3/calendars";

export class GcalHttpError extends Error {
  constructor(public status: number) {
    super(`gcal ${status}`);
    this.name = "GcalHttpError";
  }
}

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

/**
 * List a calendar's events. `filtered:true` ⇒ task-lane query (only VEGA-tagged);
 * `filtered:false` ⇒ unfiltered lived-lane query. A syncToken is bound to its
 * original query params, so window bounds are sent only on a tokenless full list
 * (Google 400s if timeMin/timeMax accompany a syncToken).
 */
export async function listEvents(
  calendarId: string,
  opts: {
    syncToken: string | null;
    filtered: boolean;
    window: { backDays: number; fwdDays: number };
  },
): Promise<{ events: GEvent[]; nextSyncToken: string | null; expired: boolean }> {
  const cal = encodeURIComponent(calendarId);
  const events: GEvent[] = [];
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  do {
    const params = new URLSearchParams({
      showDeleted: "true",
      singleEvents: "true",
      maxResults: "250",
    });
    if (opts.syncToken) {
      params.set("syncToken", opts.syncToken);
    } else {
      params.set("timeMin", new Date(Date.now() - opts.window.backDays * 864e5).toISOString());
      params.set("timeMax", new Date(Date.now() + opts.window.fwdDays * 864e5).toISOString());
      if (opts.filtered) params.set("privateExtendedProperty", "vegaTaskId=*");
    }
    if (pageToken) params.set("pageToken", pageToken);
    const res = await call(`${cal}/events?${params}`, {}, false);
    if (res.status === 410) return { events: [], nextSyncToken: null, expired: true };
    if (!res.ok) throw new GcalHttpError(res.status);
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
  if (res.status === 409 && body.id) {
    await patchEvent(calendarId, body.id, body);
    return body;
  }
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
