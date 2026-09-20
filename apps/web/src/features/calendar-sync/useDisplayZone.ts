import { useStore } from "@/core/store";
import { resolveDisplayZone } from "./timezone";

// Read once: the OS zone is fixed for a session, and CalendarPage re-renders on every
// drag frame, where constructing a formatter per render is not free.
const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The one seam every calendar-facing surface reads its zone from. */
export function useDisplayZone(): string {
  const isConnected = useStore((s) => Boolean(s.gcalStatus?.connected));
  const statusZone = useStore((s) => s.gcalStatus?.timeZone ?? null);
  return resolveDisplayZone(isConnected ? statusZone : null, BROWSER_ZONE);
}

/** Whether the display zone differs from this browser's — the traveller's off-by-one column. */
export function isForeignDisplayZone(zone: string): boolean {
  return zone !== BROWSER_ZONE;
}
