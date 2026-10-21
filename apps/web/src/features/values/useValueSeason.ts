import { useCallback } from "react";
import { useStore } from "@/core/store";
import type { Value } from "./model";

/** Rests a value or brings it back into season; returns the toast text it showed. */
export function useValueSeason() {
  const updateValue = useStore((s) => s.updateValue);
  const pushToast = useStore((s) => s.pushToast);

  const toggleSeason = useCallback(
    (value: Value): string => {
      if (value.archivedAt !== null) return "";
      const isResting = value.restingAt !== null;
      updateValue(value.id, { restingAt: isResting ? null : new Date().toISOString() });
      const message = isResting ? `${value.name} is in season.` : `${value.name} is resting.`;
      pushToast(message);
      return message;
    },
    [updateValue, pushToast],
  );

  return { toggleSeason };
}
