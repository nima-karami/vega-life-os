import { useEffect, useState } from "react";
import type { GoalStatus } from "./model";
import { getSealAnim, SEAL_ANIM_MS, type SealAnim } from "./seal";

/** A beat in flight; the user's own status change is the only trigger. */
export interface SealMotion {
  anim: SealAnim;
  /** the status the chip is leaving, stacked under the new one only while the beat plays */
  previous: GoalStatus;
}

export function useGoalSeal(status: GoalStatus) {
  const [motion, setMotion] = useState<SealMotion | null>(null);

  useEffect(() => {
    if (!motion) return;
    const timer = setTimeout(() => setMotion(null), SEAL_ANIM_MS[motion.anim]);
    return () => clearTimeout(timer);
  }, [motion]);

  const playStatusChange = (next: GoalStatus) => {
    if (next === status) return;
    const anim = getSealAnim(status, next);
    setMotion(anim ? { anim, previous: status } : null);
  };

  return { motion, playStatusChange };
}
