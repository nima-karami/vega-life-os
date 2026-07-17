import type { GEvent } from "../features/calendar/event-map";
import {
  type GoogleCalendarClient,
  GoogleHttpError,
  type WatchRequest,
} from "../features/calendar/google-client";
import { type OauthGateway, OauthHttpError, type OauthTokens } from "../features/calendar/oauth";

type RefreshBehavior = "ok" | "transient" | "revoked";

export type MockChannel = {
  channelId: string;
  channelToken: string;
  resourceId: string;
  calendarId: string;
  expiration: string;
};

/** In-memory Google Calendar + OAuth doubles: programmable token endpoint, per-calendar event store, channels. */
export class GoogleMock {
  private readonly calendars = new Map<string, Map<string, GEvent>>();
  readonly channels = new Map<string, MockChannel>();
  private refreshBehavior: RefreshBehavior = "ok";
  private pushFailuresLeft = 0;
  private clock = () => new Date().toISOString();

  setRefreshBehavior(behavior: RefreshBehavior): void {
    this.refreshBehavior = behavior;
  }

  failNextPushes(count: number): void {
    this.pushFailuresLeft = count;
  }

  seedEvent(calendarId: string, event: GEvent): void {
    this.calendarOf(calendarId).set(event.id ?? "", { updated: this.clock(), ...event });
  }

  rawEvents(calendarId: string): GEvent[] {
    return [...this.calendarOf(calendarId).values()];
  }

  eventById(calendarId: string, id: string): GEvent | undefined {
    return this.calendarOf(calendarId).get(id);
  }

  channelsForCalendar(calendarId: string): MockChannel[] {
    return [...this.channels.values()].filter((channel) => channel.calendarId === calendarId);
  }

  get gateway(): OauthGateway {
    return {
      buildConsentUrl: (state) =>
        `https://consent.example/oauth?state=${encodeURIComponent(state)}`,
      exchangeCode: async (code) => tokensFor(`refresh-${code}`),
      refresh: async () => this.doRefresh(),
    };
  }

  get client(): GoogleCalendarClient {
    return {
      listEvents: async (calendarId) => {
        return { events: this.rawEvents(calendarId) };
      },
      insertEvent: async (calendarId, body) => {
        this.consumePushBudget();
        this.calendarOf(calendarId).set(body.id ?? "", {
          ...body,
          status: "confirmed",
          updated: this.clock(),
        });
      },
      patchEvent: async (calendarId, eventId, body) => {
        this.consumePushBudget();
        const prior = this.calendarOf(calendarId).get(eventId) ?? { id: eventId };
        this.calendarOf(calendarId).set(eventId, {
          ...prior,
          ...body,
          status: "confirmed",
          updated: this.clock(),
        });
      },
      deleteEvent: async (calendarId, eventId) => {
        const prior = this.calendarOf(calendarId).get(eventId);
        if (prior) this.calendarOf(calendarId).set(eventId, { ...prior, status: "cancelled" });
      },
      insertCalendar: async (summary) => {
        const id = `mock-cal-${summary.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`;
        this.calendarOf(id);
        return { id };
      },
      watch: async (calendarId, request: WatchRequest) => {
        const resourceId = `resource-${request.channelId}`;
        const expiration = new Date(Date.now() + 7 * 864e5).toISOString();
        this.channels.set(request.channelId, {
          channelId: request.channelId,
          channelToken: request.channelToken,
          resourceId,
          calendarId,
          expiration,
        });
        return { resourceId, expiration };
      },
      stopChannel: async (channelId) => {
        this.channels.delete(channelId);
      },
    };
  }

  private doRefresh(): OauthTokens {
    if (this.refreshBehavior === "transient") throw new OauthHttpError(503, "error");
    if (this.refreshBehavior === "revoked") throw new OauthHttpError(400, "invalid_grant");
    return tokensFor(null);
  }

  private consumePushBudget(): void {
    if (this.pushFailuresLeft > 0) {
      this.pushFailuresLeft -= 1;
      throw new GoogleHttpError(503);
    }
  }

  private calendarOf(calendarId: string): Map<string, GEvent> {
    const existing = this.calendars.get(calendarId);
    if (existing) return existing;
    const created = new Map<string, GEvent>();
    this.calendars.set(calendarId, created);
    return created;
  }
}

function tokensFor(refreshToken: string | null): OauthTokens {
  return {
    accessToken: `access-${Math.random().toString(36).slice(2)}`,
    refreshToken,
    expiresInSec: 3600,
  };
}
