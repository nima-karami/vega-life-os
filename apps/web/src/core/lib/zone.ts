export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Cached because NowLine re-reads this every minute and every Today event row with it;
// constructing the formatter is the expensive part, not formatting.
const formatters = new Map<string, Intl.DateTimeFormat>();

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
