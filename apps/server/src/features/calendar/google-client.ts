import { google } from "googleapis";
import type { GEvent } from "./event-map";

export type ListWindow = { backDays: number; fwdDays: number };

export type ListEventsOptions = {
  window: ListWindow;
};

export type ListEventsResult = {
  events: GEvent[];
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
      const events: GEvent[] = [];
      let pageToken: string | undefined;
      do {
        const response = await calendar.events.list({
          calendarId,
          showDeleted: true,
          singleEvents: true,
          maxResults: 250,
          pageToken,
          ...buildWindowedParams(options.window),
        });
        events.push(...((response.data.items ?? []) as GEvent[]));
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);
      return { events };
    },
    async insertEvent(calendarId, body) {
      await calendar.events.insert({ calendarId, requestBody: body });
    },
    async patchEvent(calendarId, eventId, body) {
      await calendar.events.patch({ calendarId, eventId, requestBody: body });
    },
    async deleteEvent(calendarId, eventId) {
      try {
        await calendar.events.delete({ calendarId, eventId });
      } catch (error) {
        if (isHttpStatus(error, 404) || isHttpStatus(error, 410)) return;
        throw error;
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

function isHttpStatus(error: unknown, status: number): boolean {
  if (error instanceof GoogleHttpError) return error.status === status;
  if (typeof error !== "object" || error === null) return false;
  const record = error as Record<string, unknown>;
  return record.code === status || record.status === status;
}
