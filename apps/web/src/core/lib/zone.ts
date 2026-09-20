// Both caches exist because constructing an Intl.DateTimeFormat is the expensive part, and
// these sit on per-render paths: CalendarPage re-resolves its zone on every drag frame, and
// NowLine plus every Today event row re-read the wall clock every minute.
const formatters = new Map<string, Intl.DateTimeFormat>();
const validity = new Map<string, boolean>();

export function isValidTimeZone(timeZone: string): boolean {
  const cached = validity.get(timeZone);
  if (cached !== undefined) return cached;
  let valid: boolean;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    valid = true;
  } catch {
    valid = false;
  }
  validity.set(timeZone, valid);
  return valid;
}

function formatterFor(zone: string): Intl.DateTimeFormat {
  const cached = formatters.get(zone);
  if (cached) return cached;
  const made = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  formatters.set(zone, made);
  return made;
}

/** Wall clock of an instant in an IANA zone: the ISO date and minutes since that day's midnight. */
export function getZonedWallClock(
  instantMs: number,
  zone: string,
): { date: string; minutes: number } {
  const parts = new Map(
    formatterFor(zone)
      .formatToParts(instantMs)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    minutes: Number(parts.get("hour")) * 60 + Number(parts.get("minute")),
  };
}
