/** Streak rules were retired in the Compass release; drop the orphaned sandbox key. */
export function clearLegacyStreakRules(): void {
  try {
    localStorage.removeItem("vega.streakRules");
  } catch {
    // storage unavailable (private mode, node) — the key is harmless if it stays
  }
}
