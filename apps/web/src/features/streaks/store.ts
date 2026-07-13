import type { Slice } from "@/core/store/slice";
import { saveStreakRules } from "./config";
import { DEFAULT_RULES, type StreakRules } from "./rules";

export interface StreaksSlice {
  streakRules: StreakRules;
  /** Replace rules from a persistence load (no write-back). */
  hydrateStreakRules: (r: StreakRules) => void;
  /** User edit: apply + persist to the active home (local or cloud). */
  setStreakRules: (r: StreakRules) => void;
}

export const createStreaksSlice: Slice<StreaksSlice> = (set, get) => ({
  streakRules: DEFAULT_RULES,
  hydrateStreakRules: (r) => set({ streakRules: r }),
  setStreakRules: (r) => {
    set({ streakRules: r });
    saveStreakRules(get().authUid, r);
  },
});
