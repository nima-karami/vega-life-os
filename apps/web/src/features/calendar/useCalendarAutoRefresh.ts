import { useEffect } from "react";
import { useStore } from "@/core/store";

const REFRESH_INTERVAL_MS = 60_000;
const MIN_GAP_MS = 15_000;

/** Refetch server truth when the tab regains focus and on a modest interval while /calendar is open. */
export function useCalendarAutoRefresh(): void {
  const isConnected = useStore((s) => Boolean(s.gcalStatus?.connected));
  useEffect(() => {
    if (!isConnected) return;
    let lastRunAt = 0;
    const refresh = () => {
      if (Date.now() - lastRunAt < MIN_GAP_MS || document.visibilityState !== "visible") return;
      lastRunAt = Date.now();
      void useStore.getState().refetchAll();
      void useStore.getState().refreshGcalStatus();
    };
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isConnected]);
}
