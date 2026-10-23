import { describe, expect, it, vi } from "vitest";

const firestoreModule = vi.hoisted(() => ({ failNextImport: true, instances: 0 }));

vi.mock("firebase/app", () => ({ initializeApp: () => ({ name: "test-app" }) }));
vi.mock("firebase/auth", () => ({ getAuth: () => ({ currentUser: null }) }));
vi.mock("firebase/firestore", () => {
  if (firestoreModule.failNextImport) {
    firestoreModule.failNextImport = false;
    throw new TypeError("Failed to fetch dynamically imported module: firestore.js");
  }
  return {
    memoryLocalCache: () => ({}),
    initializeFirestore: () => {
      firestoreModule.instances += 1;
      return { type: "firestore" };
    },
  };
});

async function importConfiguredApp() {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "key");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "project");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "app");
  return import("./app");
}

describe("loadFirestore", () => {
  it("rejects on a failed chunk, then loads one shared instance on the next calls", async () => {
    const { firebaseEnabled, loadFirestore } = await importConfiguredApp();
    expect(firebaseEnabled).toBe(true);

    await expect(loadFirestore()).rejects.toThrow();

    const [first, second] = await Promise.all([loadFirestore(), loadFirestore()]);

    expect(first).toEqual({ type: "firestore" });
    expect(second).toBe(first);
    expect(await loadFirestore()).toBe(first);
    expect(firestoreModule.instances).toBe(1);
  });
});
