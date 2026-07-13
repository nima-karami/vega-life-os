/**
 * Google Identity Services token client. Firebase Auth signs the user in but does
 * not refresh Google API access tokens, so we mint calendar tokens with GIS.
 * Needs a Google OAuth Web client ID in VITE_GOOGLE_CLIENT_ID.
 */
import { setScopeVersion } from "./state";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
// Read/write events, list the user's calendars, and create a VEGA-owned calendar.
const SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.app.created",
].join(" ");
/** Bump when SCOPE changes so already-connected users are re-prompted for consent. */
export const SCOPE_VERSION = 1;

export const gcalConfigured = Boolean(CLIENT_ID);

interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void;
}
// minimal shape of the global injected by the GIS script
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (c: {
            client_id: string;
            scope: string;
            callback: (r: { access_token?: string; error?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

// Cached access token. Persisted to sessionStorage (per-tab, cleared on tab close)
// so a page refresh within the ~1h token life reuses it instead of re-prompting.
const TOKEN_KEY = "vega.gcal.access";
let token = "";
let expiresAt = 0;
let client: TokenClient | null = null;

(function hydrate() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return;
    const { t, e } = JSON.parse(raw);
    if (typeof t === "string" && typeof e === "number" && Date.now() < e) {
      token = t;
      expiresAt = e;
    }
  } catch {
    /* ignore */
  }
})();

function persist() {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ t: token, e: expiresAt }));
  } catch {
    /* ignore */
  }
}

function ensureClient(): TokenClient {
  if (client) return client;
  if (!window.google || !CLIENT_ID) throw new Error("GIS not ready");
  client = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: () => {}, // replaced per-request below
  });
  return client;
}

/** Thrown when no token can be obtained without user action — the caller surfaces
 *  "needs reconnect" and (for background syncs) keeps retrying silently so it self-heals. */
export class ReconnectRequiredError extends Error {
  constructor() {
    super("calendar reconnect required");
    this.name = "ReconnectRequiredError";
  }
}

const SILENT_TIMEOUT_MS = 8_000;

/**
 * Resolve a valid access token. A cached, unexpired token returns immediately. A
 * **non-interactive** call (boot/poll sync) attempts a *silent* token mint — with no user
 * gesture the browser can't open a popup, so it either returns a token quietly or fails,
 * never surprising the user; on failure it rejects with `ReconnectRequiredError`. Interactive
 * calls (the user clicked Reconnect) may show consent/account-chooser.
 */
export function getCalendarToken(interactive: boolean): Promise<string> {
  if (token && Date.now() < expiresAt - 60_000) return Promise.resolve(token);
  if (!window.google || !CLIENT_ID) return Promise.reject(new ReconnectRequiredError());
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    const c = ensureClient();
    (
      c as unknown as { callback: (r: { access_token?: string; error?: string }) => void }
    ).callback = (r) => {
      if (r.access_token) {
        token = r.access_token;
        expiresAt = Date.now() + 55 * 60_000; // GIS tokens ~1h
        persist();
        setScopeVersion(SCOPE_VERSION); // record which scope set the user just consented to
        finish(() => resolve(token));
      } else {
        finish(() => reject(new ReconnectRequiredError()));
      }
    };
    // A silent attempt that can't complete (no Google session / blocked iframe) may never fire
    // the callback — cap the wait so the sync cycle isn't left hanging.
    if (!interactive) {
      setTimeout(() => finish(() => reject(new ReconnectRequiredError())), SILENT_TIMEOUT_MS);
    }
    c.requestAccessToken({ prompt: "" }); // GIS shows consent only if not yet granted
  });
}

export function clearCalendarToken() {
  token = "";
  expiresAt = 0;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
export function isCalendarConnected() {
  return Boolean(token) && Date.now() < expiresAt;
}
