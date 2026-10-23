import {
  type GoogleCalendarClient,
  GoogleHttpError,
  type ListEventsResult,
  SyncTokenExpiredError,
} from "./google-client";
import type { GcalAccount } from "./token-store";

const TASK_WINDOW = { backDays: 366, fwdDays: 732 };
export const LIVED_WINDOW = { backDays: 30, fwdDays: 120 };

type ListWindow = typeof LIVED_WINDOW;

/** The dedicated VEGA calendar is gone from Google — pause-and-ask, never auto-recreate (user decision, spec §0). */
export class WriteCalendarMissingError extends Error {
  constructor() {
    super("write calendar missing");
    this.name = "WriteCalendarMissingError";
  }
}

export const isRateLimit = (status: number) => status === 429 || status === 403 || status >= 500;

const isGoneFault = (error: unknown): boolean =>
  error instanceof GoogleHttpError && (error.status === 404 || error.status === 410);

export type CalendarListing = ListEventsResult & { mode: "full" | "delta" };

export type ReadListing =
  | { kind: "ok"; listing: CalendarListing }
  | { kind: "vanished" }
  | { kind: "faulted"; rateLimited: boolean };

/** Every calendar's Google side for one run, listed once and handed to both lanes and the quiet gate. */
export type CalendarListings = { write: CalendarListing; reads: Map<string, ReadListing> };

/** Prefer the stored delta token; a 410 (or first run) falls back to one full windowed list. */
async function listCalendarEvents(
  client: GoogleCalendarClient,
  calendarId: string,
  syncTokens: Record<string, string>,
  window: ListWindow,
): Promise<CalendarListing> {
  const token = syncTokens[calendarId];
  if (token) {
    try {
      return { ...(await client.listEvents(calendarId, { syncToken: token })), mode: "delta" };
    } catch (error) {
      if (!(error instanceof SyncTokenExpiredError)) throw error;
    }
  }
  return { ...(await client.listEvents(calendarId, { window })), mode: "full" };
}

async function listWriteCalendar(
  client: GoogleCalendarClient,
  calendarId: string,
  syncTokens: Record<string, string>,
): Promise<CalendarListing> {
  try {
    return await listCalendarEvents(client, calendarId, syncTokens, TASK_WINDOW);
  } catch (error) {
    if (isGoneFault(error)) throw new WriteCalendarMissingError();
    throw error;
  }
}

/** List one read calendar, classifying a 404/410 as vanished and a 403/429/5xx as a retryable fault. */
async function classifyReadCalendar(
  client: GoogleCalendarClient,
  calendarId: string,
  syncTokens: Record<string, string>,
): Promise<ReadListing> {
  try {
    return {
      kind: "ok",
      listing: await listCalendarEvents(client, calendarId, syncTokens, LIVED_WINDOW),
    };
  } catch (error) {
    if (!(error instanceof GoogleHttpError)) throw error;
    if (isGoneFault(error)) return { kind: "vanished" };
    return { kind: "faulted", rateLimited: isRateLimit(error.status) };
  }
}

export async function listAccountCalendars(
  client: GoogleCalendarClient,
  account: GcalAccount,
): Promise<CalendarListings> {
  const writeCalendarId = account.writeCalendarId ?? "";
  const syncTokens = account.syncTokens ?? {};
  const reads = new Map<string, ReadListing>();
  for (const calendarId of account.readCalendarIds ?? []) {
    if (calendarId === writeCalendarId) continue;
    reads.set(calendarId, await classifyReadCalendar(client, calendarId, syncTokens));
  }
  const write = await listWriteCalendar(client, writeCalendarId, syncTokens);
  return { write, reads };
}
