import { useState } from "react";
import { dismissFreshStart, readFreshStartDismissal, shouldShowFreshStart } from "./fresh-start";

export function useFreshStart(today: string, viewDate: string) {
  const [dismissedFor, setDismissedFor] = useState(readFreshStartDismissal);
  return {
    isFreshStartVisible: shouldShowFreshStart(today, viewDate, dismissedFor),
    dismissForWeek: () => {
      dismissFreshStart(today);
      setDismissedFor(today);
    },
  };
}
