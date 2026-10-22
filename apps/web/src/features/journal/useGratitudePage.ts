import { useState } from "react";
import { useStore } from "@/core/store";
import { shouldShowGratitudePage } from "./selectors";

/**
 * Whether the daily gratitude page covers the app. Decided once per day: after it is
 * answered (or was never due) it stays down for that day, so clearing today's
 * gratitude in the journal mid-session never throws the page back up.
 */
export function useGratitudePage(today: string): boolean {
  const isDue = useStore((s) =>
    shouldShowGratitudePage(
      s.journal.find((entry) => entry.date === today),
      s.gratitudeNudgeAckedThrough,
      today,
    ),
  );
  const [settledFor, setSettledFor] = useState<string | null>(null);
  const isSettled = settledFor === today;
  if (!isDue && !isSettled) setSettledFor(today);
  return isDue && !isSettled;
}
