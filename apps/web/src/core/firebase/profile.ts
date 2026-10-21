import { doc, getDoc } from "firebase/firestore";
import { isValidISODate } from "@/core/lib/date";
import { getTrpcClient } from "@/core/persistence/trpc-client";
import { auth, db } from "./app";

export interface CloudProfile {
  name?: string;
  workspace?: string;
  avatar?: string;
  partnerName?: string;
  // Google Calendar connection config — user-level (follows the account across
  // devices/origins). `gcalConfigured` marks that the cloud holds config, so first
  // sign-in can migrate any pre-existing device-local config exactly once.
  gcalConfigured?: boolean;
  gcalEnabled?: boolean;
  gcalWriteCalendarId?: string | null;
  gcalReadCalendarIds?: string[];
  gcalShowEvents?: boolean;
  gratitudeNudgeAckedThrough?: string | null;
}

const readString = (value: unknown) => (typeof value === "string" ? value : undefined);
const readBoolean = (value: unknown) => (typeof value === "boolean" ? value : undefined);
const readStringArray = (value: unknown) =>
  Array.isArray(value) ? (value as string[]) : undefined;
const readISODate = (value: unknown) =>
  typeof value === "string" && isValidISODate(value) ? value : null;

export async function getCloudProfile(uid: string): Promise<CloudProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    name: readString(d.name),
    workspace: readString(d.workspace),
    avatar: readString(d.avatar),
    partnerName: readString(d.partnerName),
    gcalConfigured: readBoolean(d.gcalConfigured),
    gcalEnabled: readBoolean(d.gcalEnabled),
    gcalWriteCalendarId: readString(d.gcalWriteCalendarId),
    gcalReadCalendarIds: readStringArray(d.gcalReadCalendarIds),
    gcalShowEvents: readBoolean(d.gcalShowEvents),
    gratitudeNudgeAckedThrough: readISODate(d.gratitudeNudgeAckedThrough),
  };
}

/** Persist a profile patch via the backend — clients can't write the users/{uid} doc
 *  directly. Best-effort: settings are saved locally first, so a failed sync is swallowed. */
export async function setCloudProfile(patch: CloudProfile): Promise<void> {
  if (!auth?.currentUser) return;
  try {
    await getTrpcClient().profile.upsert.mutate(patch);
  } catch {
    /* cloud mirror is best-effort */
  }
}
