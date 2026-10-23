import { useCallback, useState } from "react";
import { useStore } from "@/core/store";
import { shouldShowGratitudePage } from "./selectors";

export interface GratitudePageState {
  /** the page covers the app, so the routed page stays unmounted */
  isUp: boolean;
  /** the page's layer is on screen: up, or playing its departure over the routed page */
  isShown: boolean;
  beginLeaving: () => void;
  endLeaving: () => void;
}

/**
 * Whether the daily gratitude page covers the app. Decided once per day: after it is
 * answered (or was never due) it stays down for that day, so clearing today's
 * gratitude in the journal mid-session never throws the page back up.
 */
export function useGratitudePage(today: string): GratitudePageState {
  const isDue = useStore((s) =>
    shouldShowGratitudePage(
      s.journal.find((entry) => entry.date === today),
      s.gratitudeNudgeAckedThrough,
      today,
    ),
  );
  const [settledFor, setSettledFor] = useState<string | null>(null);
  const [leavingFor, setLeavingFor] = useState<string | null>(null);
  const isSettled = settledFor === today;
  if (!isDue && !isSettled) setSettledFor(today);
  const isUp = isDue && !isSettled;
  const beginLeaving = useCallback(() => setLeavingFor(today), [today]);
  const endLeaving = useCallback(() => setLeavingFor(null), []);
  return { isUp, isShown: isUp || leavingFor === today, beginLeaving, endLeaving };
}
