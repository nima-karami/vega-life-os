import { getCloudProfile, setCloudProfile } from "@/core/firebase/profile";

/**
 * The missed-gratitude nudge's dismissal watermark. Signed in → the cloud profile so it
 * follows the account; signed out → localStorage (the throwaway sandbox). Mirrors the
 * streak-rules dual-home pattern.
 */
const KEY = "vega.gratitudeNudgeAckedThrough";

export function readLocalGratitudeNudgeAck(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function loadGratitudeNudgeAck(uid: string | null): Promise<string | null> {
  if (!uid) return readLocalGratitudeNudgeAck();
  const profile = await getCloudProfile(uid).catch(() => null);
  return profile?.gratitudeNudgeAckedThrough ?? null;
}

export function saveGratitudeNudgeAck(uid: string | null, ackedThrough: string): void {
  if (uid) {
    void setCloudProfile({ gratitudeNudgeAckedThrough: ackedThrough }).catch(() => {});
    return;
  }
  try {
    localStorage.setItem(KEY, ackedThrough);
  } catch {
    /* ignore */
  }
}
