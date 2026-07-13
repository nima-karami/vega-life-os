import { getCloudProfile, setCloudProfile } from "@/core/firebase/profile";

/**
 * User-level Google Calendar connection config. When signed in it lives in the cloud
 * profile (Firestore) so it follows the account across devices/origins; signed out it
 * falls back to localStorage (the throwaway sandbox). Tokens and per-calendar sync
 * cursors are NOT here — those stay strictly device-local (see google-auth / state).
 */
export interface GcalConfig {
  enabled: boolean;
  writeCalendarId: string | null;
  readCalendarIds: string[];
  showGoogleEvents: boolean;
}

export const createDefaultGcalConfig = (): GcalConfig => ({
  enabled: false,
  writeCalendarId: null,
  readCalendarIds: ["primary"],
  showGoogleEvents: true,
});

const ON = "vega.gcal.enabled";
const WRITE = "vega.gcal.writeCalendarId";
const READ = "vega.gcal.readCalendarIds";
const SHOW = "vega.gcal.showEvents";
const LEGACY = "vega.gcal.calendarId";

const readLocal = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeLocal = (key: string, value: string | null) => {
  try {
    value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

/** Device-local config (signed-out fallback, and the migration source on first sign-in). */
export function readLocalGcalConfig(): GcalConfig {
  let readIds = ["primary"];
  const rawRead = readLocal(READ);
  if (rawRead) {
    try {
      const parsed = JSON.parse(rawRead);
      if (Array.isArray(parsed) && parsed.length) readIds = parsed;
    } catch {
      /* ignore */
    }
  } else {
    const legacy = readLocal(LEGACY);
    if (legacy) readIds = [legacy];
  }
  return {
    enabled: readLocal(ON) === "1",
    writeCalendarId: readLocal(WRITE),
    readCalendarIds: readIds,
    showGoogleEvents: readLocal(SHOW) !== "0",
  };
}

function writeLocalGcalConfig(config: GcalConfig) {
  writeLocal(ON, config.enabled ? "1" : "0");
  writeLocal(WRITE, config.writeCalendarId);
  writeLocal(READ, JSON.stringify(config.readCalendarIds));
  writeLocal(SHOW, config.showGoogleEvents ? "1" : "0");
}

async function writeCloudGcalConfig(uid: string, config: GcalConfig) {
  await setCloudProfile(uid, {
    gcalConfigured: true,
    gcalEnabled: config.enabled,
    gcalWriteCalendarId: config.writeCalendarId,
    gcalReadCalendarIds: config.readCalendarIds,
    gcalShowEvents: config.showGoogleEvents,
  });
}

/** Load config from the right home; on first sign-in, migrate any local config to cloud. */
export async function loadGcalConfig(uid: string | null): Promise<GcalConfig> {
  if (!uid) return readLocalGcalConfig();
  const p = await getCloudProfile(uid).catch(() => null);
  if (p?.gcalConfigured) {
    return {
      enabled: !!p.gcalEnabled,
      writeCalendarId: p.gcalWriteCalendarId ?? null,
      readCalendarIds: p.gcalReadCalendarIds?.length ? p.gcalReadCalendarIds : ["primary"],
      showGoogleEvents: p.gcalShowEvents !== false,
    };
  }
  const local = readLocalGcalConfig();
  await writeCloudGcalConfig(uid, local).catch(() => {});
  return local;
}

/** Persist config to the right home (fire-and-forget for the cloud path). */
export function saveGcalConfig(uid: string | null, c: GcalConfig) {
  if (uid) void writeCloudGcalConfig(uid, c).catch(() => {});
  else writeLocalGcalConfig(c);
}
