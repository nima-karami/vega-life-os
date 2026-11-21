import { getZonedWallClock, isValidTimeZone } from "@vega/shared";
import type { McpClock } from "./mcp-context";

const FALLBACK_ZONE = "UTC";

const padTwo = (value: number) => String(value).padStart(2, "0");

function buildNoonDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function computeZonedClock(timeZone: string, nowMs: number): McpClock {
  const zone = isValidTimeZone(timeZone) ? timeZone : FALLBACK_ZONE;
  const wallClock = getZonedWallClock(nowMs, zone);
  // Every live IANA offset is a whole number of minutes, so seconds are zone-independent.
  const seconds = Math.floor(nowMs / 1000) % 60;
  const time = `${padTwo(Math.floor(wallClock.minutes / 60))}:${padTwo(wallClock.minutes % 60)}:${padTwo(seconds)}`;
  return {
    today: wallClock.date,
    nowLocal: `${wallClock.date}T${time}`,
    nowIso: new Date(nowMs).toISOString(),
    noonDate: buildNoonDate(wallClock.date),
    dayOf: (instantIso) => getZonedWallClock(Date.parse(instantIso), zone).date,
  };
}
