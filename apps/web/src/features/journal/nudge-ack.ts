import { setCloudProfile } from "@/core/firebase/profile";
import { isValidISODate } from "@/core/lib/date";

// Signed in it lives on the cloud profile (hydrated with the account); signed out, here.
const KEY = "vega.gratitudeNudgeAckedThrough";

export function readLocalGratitudeNudgeAck(): string | null {
  try {
    const stored = localStorage.getItem(KEY);
    return isValidISODate(stored) ? stored : null;
  } catch {
    return null;
  }
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
