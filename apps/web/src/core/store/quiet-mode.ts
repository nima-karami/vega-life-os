import { setCloudProfile } from "@/core/firebase/profile";

// Signed in it lives on the cloud profile (hydrated with the account); signed out, here.
const KEY = "vega.quietMode";

export function readLocalQuietMode(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveQuietMode(uid: string | null, isQuiet: boolean): void {
  if (uid) {
    void setCloudProfile({ quietMode: isQuiet }).catch(() => {});
    return;
  }
  try {
    localStorage.setItem(KEY, isQuiet ? "on" : "off");
  } catch {
    /* ignore */
  }
}
