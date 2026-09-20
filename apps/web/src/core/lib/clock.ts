import { useSyncExternalStore } from "react";
import { todayISO } from "./date";
import { getZonedWallClock } from "./zone";

/** ms remaining until the next wall-clock minute boundary (self-correcting, no drift). */
export function msUntilNextMinute(nowMs: number): number {
  const rem = nowMs % 60_000;
  return rem === 0 ? 60_000 : 60_000 - rem;
}

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let nowMs = Date.now();

function emit() {
  nowMs = Date.now();
  for (const l of listeners) l();
}

function schedule() {
  // Re-align to the minute boundary each tick so the now-line flips exactly when
  // the displayed minute changes and the day rolls over within ~a minute.
  timer = setTimeout(() => {
    emit();
    schedule();
  }, msUntilNextMinute(Date.now()));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

/** Wall-clock time in ms, re-rendering the caller about once a minute (minute-aligned). */
export function useNowMs(): number {
  return useSyncExternalStore(
    subscribe,
    () => nowMs,
    () => nowMs,
  );
}

/** Today's ISO date; re-renders the caller only when the calendar day changes. */
export function useTodayISO(): string {
  return useSyncExternalStore(
    subscribe,
    () => todayISO(new Date(nowMs)),
    () => todayISO(new Date(nowMs)),
  );
}

/** Today's ISO date in a given zone; re-renders the caller only when that zone's day changes. */
export function useZonedTodayISO(zone: string): string {
  return useSyncExternalStore(
    subscribe,
    () => getZonedWallClock(nowMs, zone).date,
    () => getZonedWallClock(nowMs, zone).date,
  );
}
