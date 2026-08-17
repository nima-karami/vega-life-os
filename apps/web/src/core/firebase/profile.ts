import { doc, getDoc } from "firebase/firestore";
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
  // Streak-healing rules — user-level (follows the account). `streakRulesConfigured`
  // marks that the cloud holds rules, so first sign-in migrates any device-local set once.
  streakRulesConfigured?: boolean;
  streakGraceDays?: number;
  streakBridgeEnabled?: boolean;
  streakLongMin?: number;
  streakRecoveryLen?: number;
  streakMendCooldownDays?: number;
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
    partnerName: typeof d.partnerName === "string" ? d.partnerName : undefined,
    gcalConfigured: typeof d.gcalConfigured === "boolean" ? d.gcalConfigured : undefined,
    gcalEnabled: typeof d.gcalEnabled === "boolean" ? d.gcalEnabled : undefined,
    gcalWriteCalendarId:
      typeof d.gcalWriteCalendarId === "string" ? d.gcalWriteCalendarId : undefined,
    gcalReadCalendarIds: Array.isArray(d.gcalReadCalendarIds)
      ? (d.gcalReadCalendarIds as string[])
      : undefined,
    gcalShowEvents: typeof d.gcalShowEvents === "boolean" ? d.gcalShowEvents : undefined,
    streakRulesConfigured:
      typeof d.streakRulesConfigured === "boolean" ? d.streakRulesConfigured : undefined,
    streakGraceDays: typeof d.streakGraceDays === "number" ? d.streakGraceDays : undefined,
    streakBridgeEnabled:
      typeof d.streakBridgeEnabled === "boolean" ? d.streakBridgeEnabled : undefined,
    streakLongMin: typeof d.streakLongMin === "number" ? d.streakLongMin : undefined,
    streakRecoveryLen: typeof d.streakRecoveryLen === "number" ? d.streakRecoveryLen : undefined,
    streakMendCooldownDays:
      typeof d.streakMendCooldownDays === "number" ? d.streakMendCooldownDays : undefined,
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
