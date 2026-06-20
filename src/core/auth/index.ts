import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { auth, firebaseEnabled } from "@/core/firebase/app";

const provider = new GoogleAuthProvider();

// Phase C (Google Calendar) adds calendar scope here later.

export { firebaseEnabled };

export function onAuth(cb: (user: User | null) => void): () => void {
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error("Firebase not configured");
  await signInWithPopup(auth, provider);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  if (!auth) throw new Error("Firebase not configured");
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  if (!auth) throw new Error("Firebase not configured");
  await createUserWithEmailAndPassword(auth, email, password);
}

/** Map a Firebase auth error to a short, human message for a toast. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/missing-password":
      return "Enter a password.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/email-already-in-use":
      return "That email already has an account — try signing in.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";
    case "auth/too-many-requests":
      return "Too many attempts — wait a minute and retry.";
    default:
      return "Sign-in failed. Check the details and try again.";
  }
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await fbSignOut(auth);
}
