import { loadServerConfig, type ServerConfig } from "../core/config";

export function requireEmulator(): void {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is unset — server tests run under `firebase emulators:exec`",
    );
  }
}

export function resolveEmulatorConfig(): ServerConfig {
  requireEmulator();
  const config = loadServerConfig();
  return { ...config, dbName: config.dbName || "test" };
}
