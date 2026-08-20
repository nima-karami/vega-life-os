import { useLayoutEffect, useState } from "react";
import { NAV_CLEARANCE_FALLBACK_PX } from "@/features/cards/face/face-metrics";

/** The live rendered height of the overlaid bottom nav (including its own
 *  safe-area-bottom padding), or NAV_CLEARANCE_FALLBACK_PX before the nav has
 *  mounted/measured. */
export function useNavClearance(): number {
  const [navClearancePx, setNavClearancePx] = useState(NAV_CLEARANCE_FALLBACK_PX);

  useLayoutEffect(() => {
    const nav = document.querySelector<HTMLElement>("[data-bottom-nav]");
    if (nav === null) return;
    const measure = () => setNavClearancePx(nav.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  return navClearancePx;
}
