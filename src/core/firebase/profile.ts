import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./app";

export interface CloudProfile {
  name?: string;
  workspace?: string;
  avatar?: string;
  // Google Calendar connection config — user-level (follows the account across
  // devices/origins). `gcalConfigured` marks that the cloud holds config, so first
  // sign-in can migrate any pre-existing device-local config exactly once.
  gcalConfigured?: boolean;
  gcalEnabled?: boolean;
  gcalWriteCalendarId?: string | null;
  gcalReadCalendarIds?: string[];
  gcalShowEvents?: boolean;
}

export async function getCloudProfile(uid: string): Promise<CloudProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    name: typeof d.name === "string" ? d.name : undefined,
    workspace: typeof d.workspace === "string" ? d.workspace : undefined,
    avatar: typeof d.avatar === "string" ? d.avatar : undefined,
    gcalConfigured: typeof d.gcalConfigured === "boolean" ? d.gcalConfigured : undefined,
    gcalEnabled: typeof d.gcalEnabled === "boolean" ? d.gcalEnabled : undefined,
    gcalWriteCalendarId:
      typeof d.gcalWriteCalendarId === "string" ? d.gcalWriteCalendarId : undefined,
    gcalReadCalendarIds: Array.isArray(d.gcalReadCalendarIds)
      ? (d.gcalReadCalendarIds as string[])
      : undefined,
    gcalShowEvents: typeof d.gcalShowEvents === "boolean" ? d.gcalShowEvents : undefined,
  };
}

export async function setCloudProfile(uid: string, patch: CloudProfile): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, "users", uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}
