/** Goal reached · Seal: which beat a user's status change plays. Pure; `useGoalSeal` owns the timer. */
import type { GoalStatus } from "./model";

export type SealAnim = "seal" | "unseal";

/** How long each beat keeps `data-anim` set, from the GoalSeal board. */
export const SEAL_ANIM_MS: Record<SealAnim, number> = { seal: 900, unseal: 400 };

export function getSealAnim(from: GoalStatus, to: GoalStatus): SealAnim | null {
  if (from === to) return null;
  if (to === "done") return "seal";
  if (from === "done") return "unseal";
  return null;
}
