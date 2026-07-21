import { getCloudProfile, setCloudProfile } from "@/core/firebase/profile";

/** The one client-owned display pref: the global Google-events eye toggle (profile-persisted). */
export async function loadShowGoogleEvents(uid: string | null): Promise<boolean> {
  if (!uid) return true;
  const profile = await getCloudProfile(uid).catch(() => null);
  return profile?.gcalShowEvents !== false;
}

export function saveShowGoogleEvents(uid: string | null, visible: boolean): void {
  if (uid) void setCloudProfile({ gcalShowEvents: visible }).catch(() => {});
}
