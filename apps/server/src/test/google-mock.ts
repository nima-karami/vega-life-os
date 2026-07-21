import type { GEvent, GEventTime } from "../features/calendar/event-map";
import {
  type GCalendarInfo,
  type GoogleCalendarClient,
  GoogleHttpError,
  SyncTokenExpiredError,
  type WatchRequest,
} from "../features/calendar/google-client";
import { type OauthGateway, OauthHttpError, type OauthTokens } from "../features/calendar/oauth";

type RefreshBehavior = "ok" | "transient" | "revoked";

const hasOffset = (dateTime: string) => /(?:Z|[+-]\d{2}:\d{2})$/.test(dateTime);

function zoneOffsetMs(timeZone: string, instant: Date): number {
  const parts = new Map(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.get("year")),
    Number(parts.get("month")) - 1,
    Number(parts.get("day")),
    Number(parts.get("hour")),
    Number(parts.get("minute")),
    Number(parts.get("second")),
  );
  return asUtc - instant.getTime();
}

function offsetSuffix(offsetMs: number): string {
  if (offsetMs === 0) return "Z";
  const sign = offsetMs > 0 ? "+" : "-";
  const total = Math.abs(offsetMs) / 60000;
  const pad = (value: number) => String(Math.floor(value)).padStart(2, "0");
  return `${sign}${pad(total / 60)}:${pad(total % 60)}`;
}

/** Google echoes a pushed naive wall-clock verbatim with the zone's offset suffix, not a UTC instant. */
function toAbsolute(time: GEventTime | undefined): GEventTime | undefined {
  if (!time?.dateTime || hasOffset(time.dateTime)) return time;
  // Single-iteration offset guess; can be off exactly at a DST gap — acceptable for a mock.
  const guess = new Date(`${time.dateTime}Z`);
  const offsetMs = zoneOffsetMs(time.timeZone ?? "UTC", guess);
  return { ...time, dateTime: `${time.dateTime}${offsetSuffix(offsetMs)}` };
}

function withAbsoluteTimes(event: GEvent): GEvent {
  const next = { ...event };
  if (event.start) next.start = toAbsolute(event.start);
  if (event.end) next.end = toAbsolute(event.end);
  return next;
}

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
  private readonly versions = new Map<string, number>();
  private readonly eventVersions = new Map<string, Map<string, number>>();
  private readonly tokenEpochs = new Map<string, number>();
  private readonly calendarInfos: GCalendarInfo[] = [];
  private listFailures: number[] = [];

  setRefreshBehavior(behavior: RefreshBehavior): void {
    this.refreshBehavior = behavior;
  }

  failNextPushes(count: number): void {
    this.pushFailuresLeft = count;
  }

  seedCalendarInfo(info: GCalendarInfo): void {
    this.calendarInfos.push(info);
  }

  expireSyncTokens(calendarId: string): void {
    this.tokenEpochs.set(calendarId, (this.tokenEpochs.get(calendarId) ?? 0) + 1);
  }

  failNextList(status: number): void {
    this.listFailures.push(status);
  }

  seedEvent(calendarId: string, event: GEvent): void {
    this.calendarOf(calendarId).set(event.id ?? "", {
      updated: this.clock(),
      ...withAbsoluteTimes(event),
    });
    this.bumpVersion(calendarId, event.id ?? "");
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
      listEvents: async (calendarId, options) => {
        const failStatus = this.listFailures.shift();
        if (failStatus) throw new GoogleHttpError(failStatus);
        if ("syncToken" in options) {
          const [tokenCal, tokenEpoch, tokenVersion] = options.syncToken.split("|");
          const epoch = this.tokenEpochs.get(calendarId) ?? 0;
          if (tokenCal !== calendarId || Number(tokenEpoch) !== epoch) {
            throw new SyncTokenExpiredError();
          }
          const since = Number(tokenVersion);
          const byEvent = this.eventVersions.get(calendarId) ?? new Map<string, number>();
          const events = this.rawEvents(calendarId).filter(
            (event) => (byEvent.get(event.id ?? "") ?? 0) > since,
          );
          return { events, nextSyncToken: this.mintToken(calendarId) };
        }
        return { events: this.rawEvents(calendarId), nextSyncToken: this.mintToken(calendarId) };
      },
      listCalendars: async () => [...this.calendarInfos],
      insertEvent: async (calendarId, body) => {
        this.consumePushBudget();
        this.calendarOf(calendarId).set(body.id ?? "", {
          ...withAbsoluteTimes(body),
          status: "confirmed",
          updated: this.clock(),
        });
        this.bumpVersion(calendarId, body.id ?? "");
      },
      patchEvent: async (calendarId, eventId, body) => {
        this.consumePushBudget();
        const prior = this.calendarOf(calendarId).get(eventId) ?? { id: eventId };
        this.calendarOf(calendarId).set(eventId, {
          ...prior,
          ...withAbsoluteTimes(body),
          status: "confirmed",
          updated: this.clock(),
        });
        this.bumpVersion(calendarId, eventId);
      },
      deleteEvent: async (calendarId, eventId) => {
        const prior = this.calendarOf(calendarId).get(eventId);
        if (prior) this.calendarOf(calendarId).set(eventId, { ...prior, status: "cancelled" });
        this.bumpVersion(calendarId, eventId);
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

  private bumpVersion(calendarId: string, eventId: string): void {
    const version = (this.versions.get(calendarId) ?? 0) + 1;
    this.versions.set(calendarId, version);
    const byEvent = this.eventVersions.get(calendarId) ?? new Map<string, number>();
    byEvent.set(eventId, version);
    this.eventVersions.set(calendarId, byEvent);
  }

  private mintToken(calendarId: string): string {
    const epoch = this.tokenEpochs.get(calendarId) ?? 0;
    return `${calendarId}|${epoch}|${this.versions.get(calendarId) ?? 0}`;
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
