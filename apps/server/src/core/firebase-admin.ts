import { type App, getApps, initializeApp } from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";
import type { ServerConfig } from "./config";

export type AdminServices = {
  app: App;
  firestore: Firestore;
  auth: Auth;
};

const DEFAULT_DATABASE = "(default)";

export function initAdmin(
  config: Pick<ServerConfig, "projectId" | "dbName">,
  appName?: string,
): AdminServices {
  const app = resolveApp(config.projectId, appName);
  const firestore =
    config.dbName && config.dbName !== DEFAULT_DATABASE
      ? getFirestore(app, config.dbName)
      : getFirestore(app);
  const auth = getAuth(app);
  return { app, firestore, auth };
}

function resolveApp(projectId: string, appName?: string): App {
  if (appName) {
    const existing = getApps().find((candidate) => candidate.name === appName);
    return existing ?? initializeApp({ projectId }, appName);
  }
  const [existing] = getApps();
  return existing ?? initializeApp({ projectId });
}
