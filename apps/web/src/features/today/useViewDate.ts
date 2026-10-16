import { useSearchParams } from "react-router";
import { shiftISO } from "@/core/lib/date";
import { resolveViewDate } from "./today-logic";

/** The Today page's viewed day, held in `?date=` so Back from a deep link restores it. */
export function useViewDate(today: string) {
  const [params, setParams] = useSearchParams();
  const viewDate = resolveViewDate(params.get("date"), today);

  // Router updates render in a transition, so a rapid second press would read a stale
  // render; the live URL is already current.
  const readLiveParams = () => new URLSearchParams(window.location.search);

  const setViewDate = (next: string) => {
    const nextParams = readLiveParams();
    if (next === today) nextParams.delete("date");
    else nextParams.set("date", next);
    setParams(nextParams, { replace: true });
  };

  const stepViewDate = (days: number) =>
    setViewDate(shiftISO(resolveViewDate(readLiveParams().get("date"), today), days));

  return { viewDate, setViewDate, stepViewDate };
}
