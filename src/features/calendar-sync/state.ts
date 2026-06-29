const READ = "vega.gcal.readCalendarIds";
const WRITE = "vega.gcal.writeCalendarId";
const TOKEN = (cal: string) => `vega.gcal.syncToken.${cal}`;
const ON = "vega.gcal.enabled";
const SCOPE = "vega.gcal.scopeVersion";
const LEGACY = "vega.gcal.calendarId";

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export const getReadCalendarIds = (): string[] => {
  const raw = read(READ);
  if (!raw) return ["primary"];
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) && a.length ? a : ["primary"];
  } catch {
    return ["primary"];
  }
};
export const setReadCalendarIds = (ids: string[]) => write(READ, JSON.stringify(ids));

export const getWriteCalendarId = (): string | null => read(WRITE);
export const setWriteCalendarId = (id: string | null) => write(WRITE, id);

export const getSyncToken = (cal: string): string | null => read(TOKEN(cal));
export const setSyncToken = (cal: string, v: string | null) => write(TOKEN(cal), v);

export const isEnabled = () => read(ON) === "1";
export const setEnabled = (v: boolean) => write(ON, v ? "1" : "0");

const SHOW = "vega.gcal.showEvents";
export const getShowGoogleEvents = () => read(SHOW) !== "0"; // default on
export const setShowGoogleEvents = (v: boolean) => write(SHOW, v ? "1" : "0");

export const getScopeVersion = () => Number(read(SCOPE) ?? "0");
export const setScopeVersion = (n: number) => write(SCOPE, String(n));

/** Rolling sync horizon (days back / forward) bounding each tokenless full list. */
export const getWindow = () => ({ backDays: 28, fwdDays: 56 });

/** One-time: an old single calendarId seeds the read-set; the write target is left to
 *  the engine to auto-create the dedicated VEGA calendar (don't inherit primary). */
export function migrateLegacyCalendarId() {
  const legacy = read(LEGACY);
  if (legacy && !read(READ)) setReadCalendarIds([legacy]);
  if (legacy) write(LEGACY, null);
}
migrateLegacyCalendarId();
