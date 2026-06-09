import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, firebaseEnabled } from "@/core/firebase/app";

const provider = new GoogleAuthProvider();
// Phase C (Google Calendar) adds calendar scope here later.

export { firebaseEnabled };

export function onAuth(cb: (user: User | null) => void): () => void {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error("Firebase not configured");
  await signInWithPopup(auth, provider);
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await fbSignOut(auth);
}
