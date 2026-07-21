import { google } from "googleapis";
import type { GEvent } from "./event-map";

export type ListWindow = { backDays: number; fwdDays: number };

export type ListEventsOptions = { window: ListWindow } | { syncToken: string };

export type ListEventsResult = { events: GEvent[]; nextSyncToken: string | null };

/** The stored syncToken is no longer valid (HTTP 410) — the caller falls back to one full windowed list. */
export class SyncTokenExpiredError extends Error {
  constructor() {
    super("sync token expired");
    this.name = "SyncTokenExpiredError";
  }
}

export type GCalendarInfo = {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string | null;
};

export type WatchRequest = {
  channelId: string;
  channelToken: string;
  address: string;
};

export type WatchResult = { resourceId: string; expiration: string };

/** A Google Calendar API fault carrying its HTTP status — the engines classify push failures on it. */
export class GoogleHttpError extends Error {
  constructor(readonly status: number) {
    super(`google calendar ${status}`);
    this.name = "GoogleHttpError";
  }
}

/** The Google Calendar surface the sync engines depend on — a real impl and an in-memory mock satisfy it. */
export type GoogleCalendarClient = {
  listEvents(calendarId: string, options: ListEventsOptions): Promise<ListEventsResult>;
  listCalendars(): Promise<GCalendarInfo[]>;
  insertEvent(calendarId: string, body: GEvent): Promise<void>;
  patchEvent(calendarId: string, eventId: string, body: GEvent): Promise<void>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  insertCalendar(summary: string): Promise<{ id: string }>;
  watch(calendarId: string, request: WatchRequest): Promise<WatchResult>;
  stopChannel(channelId: string, resourceId: string): Promise<void>;
};

function buildWindowedParams(window: ListWindow): Record<string, unknown> {
  return {
    timeMin: new Date(Date.now() - window.backDays * 864e5).toISOString(),
    timeMax: new Date(Date.now() + window.fwdDays * 864e5).toISOString(),
  };
}

/** A real client bound to one access token; the engines get a fresh one per uid from the token store. */
export function createGoogleClient(accessToken: string): GoogleCalendarClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  return {
    async listEvents(calendarId, options) {
      const modeParams =
        "syncToken" in options
          ? { syncToken: options.syncToken }
          : buildWindowedParams(options.window);
      const events: GEvent[] = [];
      let pageToken: string | undefined;
      let nextSyncToken: string | null = null;
      try {
        do {
          const response = await calendar.events.list({
            calendarId,
            showDeleted: true,
            singleEvents: true,
            maxResults: 250,
            pageToken,
            ...modeParams,
          });
          events.push(...((response.data.items ?? []) as GEvent[]));
          pageToken = response.data.nextPageToken ?? undefined;
          nextSyncToken = response.data.nextSyncToken ?? nextSyncToken;
        } while (pageToken);
      } catch (error) {
        throw toListError(error, "syncToken" in options);
      }
      return { events, nextSyncToken };
    },
    async listCalendars() {
      const calendars: GCalendarInfo[] = [];
      let pageToken: string | undefined;
      do {
        const response = await calendar.calendarList.list({ maxResults: 250, pageToken });
        for (const item of response.data.items ?? []) {
          calendars.push({
            id: item.id ?? "",
            summary: item.summary ?? "",
            primary: item.primary ?? false,
            backgroundColor: item.backgroundColor ?? null,
          });
        }
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);
      return calendars;
    },
    async insertEvent(calendarId, body) {
      try {
        await calendar.events.insert({ calendarId, requestBody: body });
      } catch (error) {
        throw toWriteError(error);
      }
    },
    async patchEvent(calendarId, eventId, body) {
      try {
        await calendar.events.patch({ calendarId, eventId, requestBody: body });
      } catch (error) {
        throw toWriteError(error);
      }
    },
    async deleteEvent(calendarId, eventId) {
      try {
        await calendar.events.delete({ calendarId, eventId });
      } catch (error) {
        if (isHttpStatus(error, 404) || isHttpStatus(error, 410)) return;
        throw toWriteError(error);
      }
    },
    async insertCalendar(summary) {
      const response = await calendar.calendars.insert({ requestBody: { summary } });
      return { id: response.data.id ?? "" };
    },
    async watch(calendarId, request) {
      const response = await calendar.events.watch({
        calendarId,
        requestBody: {
          id: request.channelId,
          type: "web_hook",
          address: request.address,
          token: request.channelToken,
        },
      });
      return {
        resourceId: response.data.resourceId ?? "",
        expiration: response.data.expiration
          ? new Date(Number(response.data.expiration)).toISOString()
          : "",
      };
    },
    async stopChannel(channelId, resourceId) {
      await calendar.channels.stop({ requestBody: { id: channelId, resourceId } });
    },
  };
}

function httpStatusOf(error: unknown): number | null {
  if (error instanceof GoogleHttpError) return error.status;
  if (typeof error !== "object" || error === null) return null;
  const record = error as Record<string, unknown>;
  const code = record.code ?? record.status;
  return typeof code === "number" ? code : null;
}

function isHttpStatus(error: unknown, status: number): boolean {
  return httpStatusOf(error) === status;
}

/** Any HTTP-status-bearing write fault becomes a GoogleHttpError so the engines classify it; an unknown-shaped error rethrows as-is. */
function toWriteError(error: unknown): unknown {
  const status = httpStatusOf(error);
  return status == null ? error : new GoogleHttpError(status);
}

function toListError(error: unknown, isTokenMode: boolean): Error {
  if (isTokenMode && isHttpStatus(error, 410)) return new SyncTokenExpiredError();
  for (const status of [403, 404, 410, 429, 500, 502, 503]) {
    if (isHttpStatus(error, status)) return new GoogleHttpError(status);
  }
  return error instanceof Error ? error : new GoogleHttpError(500);
}
