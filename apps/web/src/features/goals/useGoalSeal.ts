import { useEffect, useState } from "react";
import type { GoalStatus } from "./model";
import { getSealAnim, SEAL_ANIM_MS, type SealAnim } from "./seal";

export interface SealMotion {
  /** set only while a beat plays; the user's own status change is the only trigger */
  anim: SealAnim | null;
  /** the status the chip is leaving; kept stacked (and hidden) so the chip never changes width */
  previous: GoalStatus;
}

export function useGoalSeal(status: GoalStatus) {
  const [motion, setMotion] = useState<SealMotion | null>(null);

  useEffect(() => {
    const anim = motion?.anim;
    if (!anim) return;
    const timer = setTimeout(
      () => setMotion((current) => current && { ...current, anim: null }),
      SEAL_ANIM_MS[anim],
    );
    return () => clearTimeout(timer);
  }, [motion]);

  const playStatusChange = (next: GoalStatus) => {
    if (next === status) return;
    const anim = getSealAnim(status, next);
    setMotion(anim ? { anim, previous: status } : null);
  };

  return { motion, playStatusChange };
}
