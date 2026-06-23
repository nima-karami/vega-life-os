import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./app";

export interface CloudProfile {
  name?: string;
  workspace?: string;
  avatar?: string;
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
  };
}

export async function setCloudProfile(uid: string, patch: CloudProfile): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, "users", uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}
