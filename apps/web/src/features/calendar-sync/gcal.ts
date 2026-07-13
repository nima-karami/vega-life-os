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
      // No server-side privateExtendedProperty filter: the VEGA write-calendar is app-owned, so
      // listing it unfiltered surfaces every event we wrote (incl. legacy/stale ids) for eviction.
    }
    if (pageToken) params.set("pageToken", pageToken);
    const response = await call(`${cal}/events?${params}`, {}, false);
    if (response.status === 410) return { events: [], nextSyncToken: null, expired: true };
    if (!response.ok) throw new GcalHttpError(response.status);
    const payload = await response.json();
    events.push(...(payload.items ?? []));
    pageToken = payload.nextPageToken ?? null;
    nextSyncToken = payload.nextSyncToken ?? nextSyncToken;
  } while (pageToken);
  return { events, nextSyncToken, expired: false };
}

// Google's per-API batch endpoint (the global /batch was discontinued; this one is supported).
// One multipart/mixed round-trip carries many ops, so a delete+insert pair is atomic per request
// (closing the partial-failure duplicate window) and N writes cost one HTTP round-trip.

const BATCH_URL = "https://www.googleapis.com/batch/calendar/v3";
const SUB_BASE = "/calendar/v3/calendars"; // sub-request path prefix — host is NOT allowed here
const BATCH_CHUNK = 50; // « the 600/user/min cap; ordering within a batch is not guaranteed

export interface BatchOp {
  kind: "insert" | "patch" | "delete";
  id: string; // gEventId — both the Content-ID correlation and the resource id for patch/delete
  body?: GEvent; // insert/patch only
}
export type BatchClass = "ok" | "needs-patch" | "auth" | "transient";
export interface BatchResult {
  id: string;
  status: number;
  class: BatchClass;
}

function classify(kind: BatchOp["kind"], status: number): BatchClass {
  if (status === 401) return "auth";
  if (status === 403 || status === 429 || status >= 500) return "transient";
  if (status >= 200 && status < 300) return "ok";
  if (kind === "insert" && status === 409) return "needs-patch"; // exists/tombstone → patch
  if (kind === "delete" && (status === 404 || status === 410)) return "ok"; // already gone
  return "transient";
}

function subRequest(calendarId: string, op: BatchOp): string {
  const events = `${SUB_BASE}/${encodeURIComponent(calendarId)}/events`;
  if (op.kind === "insert") return `POST ${events}`;
  return `${op.kind === "patch" ? "PATCH" : "DELETE"} ${events}/${op.id}`;
}

function buildMultipart(calendarId: string, ops: BatchOp[], boundary: string): string {
  const parts = ops.map((op) => {
    const hasBody = op.kind !== "delete";
    const headers = hasBody ? "Content-Type: application/json\r\n" : "";
    const payload = hasBody ? `\r\n${JSON.stringify(op.body)}\r\n` : "\r\n";
    return (
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-ID: ${op.id}\r\n\r\n` +
      `${subRequest(calendarId, op)} HTTP/1.1\r\n${headers}${payload}`
    );
  });
  return `${parts.join("")}--${boundary}--\r\n`;
}

function parseMultipart(text: string, ops: BatchOp[]): BatchResult[] {
  const kindById = new Map(ops.map((o) => [o.id, o.kind]));
  const results: BatchResult[] = [];
  const seen = new Set<string>();
  // Split on any boundary line (`--<boundary>`); each segment is one sub-response.
  for (const seg of text.split(/--[^\r\n]+\r?\n/)) {
    const statusM = seg.match(/HTTP\/\d\.\d\s+(\d{3})/);
    const idM = seg.match(/Content-ID:\s*response-([^\r\n]+)/i);
    if (!statusM || !idM) continue;
    const id = idM[1].trim();
    const status = Number(statusM[1]);
    seen.add(id);
    results.push({ id, status, class: classify(kindById.get(id) ?? "patch", status) });
  }
  // Any op without a matching part → retry next cycle (the set-difference is idempotent).
  for (const o of ops)
    if (!seen.has(o.id)) results.push({ id: o.id, status: 0, class: "transient" });
  return results;
}

async function batchChunk(calendarId: string, ops: BatchOp[]): Promise<BatchResult[]> {
  const token = await getCalendarToken(false);
  const boundary = `vega_batch_${crypto.randomUUID()}`;
  const response = await fetch(BATCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
    },
    body: buildMultipart(calendarId, ops, boundary),
  });
  if (!response.ok) throw new GcalHttpError(response.status); // envelope fault (401 → reconnect, 403/429 → backoff)
  return parseMultipart(await response.text(), ops);
}

/** Run insert/patch/delete ops against one calendar in batched multipart round-trips. */
export async function batchWrite(calendarId: string, ops: BatchOp[]): Promise<BatchResult[]> {
  const out: BatchResult[] = [];
  for (let i = 0; i < ops.length; i += BATCH_CHUNK) {
    out.push(...(await batchChunk(calendarId, ops.slice(i, i + BATCH_CHUNK))));
  }
  return out;
}
