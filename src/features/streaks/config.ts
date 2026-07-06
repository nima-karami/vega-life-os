import { getCloudProfile, setCloudProfile } from "@/core/firebase/profile";
import { coerceRules, DEFAULT_RULES, type StreakRules } from "./rules";

/**
 * Streak-healing rules persistence. Signed in → the cloud profile (Firestore) so the
 * rules follow the account; signed out → localStorage (the throwaway sandbox). Mirrors
 * the GcalConfig dual-home pattern.
 */
const KEY = "vega.streakRules";

export function readLocalStreakRules(): StreakRules {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return coerceRules(JSON.parse(raw) as Partial<StreakRules>);
  } catch {
    /* ignore */
  }
  return DEFAULT_RULES;
}

function writeLocalStreakRules(r: StreakRules) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

async function writeCloudStreakRules(uid: string, r: StreakRules) {
  await setCloudProfile(uid, {
    streakRulesConfigured: true,
    streakGraceDays: r.graceDays,
    streakBridgeEnabled: r.bridgeEnabled,
    streakLongMin: r.longStreakMin,
    streakRecoveryLen: r.recoveryLen,
    streakMendCooldownDays: r.mendCooldownDays,
  });
}

/** Load from the right home; on first sign-in, migrate any local config to cloud once. */
export async function loadStreakRules(uid: string | null): Promise<StreakRules> {
  if (!uid) return readLocalStreakRules();
  const p = await getCloudProfile(uid).catch(() => null);
  if (p?.streakRulesConfigured) {
    return coerceRules({
      graceDays: p.streakGraceDays,
      bridgeEnabled: p.streakBridgeEnabled,
      longStreakMin: p.streakLongMin,
      recoveryLen: p.streakRecoveryLen,
      mendCooldownDays: p.streakMendCooldownDays,
    });
  }
  const local = readLocalStreakRules();
  await writeCloudStreakRules(uid, local).catch(() => {});
  return local;
}

/** Persist to the right home. Local write is synchronous; cloud is best-effort (offline-tolerant). */
export function saveStreakRules(uid: string | null, r: StreakRules) {
  if (uid) void writeCloudStreakRules(uid, r).catch(() => {});
  else writeLocalStreakRules(r);
}
