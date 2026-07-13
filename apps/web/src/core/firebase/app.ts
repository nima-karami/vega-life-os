import { type FirebaseApp, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import { type Firestore, initializeFirestore, memoryLocalCache } from "firebase/firestore";

/**
 * Firebase is optional. With no VITE_FIREBASE_* env vars the app runs fully
 * local (Dexie). Drop a web-app config into .env.local to enable cloud sync.
 */
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(cfg.apiKey && cfg.projectId && cfg.appId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (firebaseEnabled) {
  app = initializeApp(cfg);
  authInstance = getAuth(app);
  // Cloud-only for real data: memory cache, no app data persisted to disk.
  dbInstance = initializeFirestore(app, { localCache: memoryLocalCache() });
}

export const auth = authInstance;
export const db = dbInstance;
