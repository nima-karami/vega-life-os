import { describe, expect, it } from "vitest";
import { loadServerConfig } from "../../core/config";
import { initAdmin } from "../../core/firebase-admin";
import { createAdminVerifier, makeCreateContext } from "../../trpc/context";

const PROJECT_ID = "vega-life-os";
const FOREIGN_PROJECT_ID = "some-other-project";

async function mintIdToken(uid: string): Promise<string> {
  const { auth } = initAdmin({ projectId: PROJECT_ID, dbName: "test" }, "mint-app");
  const customToken = await auth.createCustomToken(uid);
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const res = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = (await res.json()) as { idToken?: string; error?: unknown };
  if (!body.idToken) throw new Error(`sign-in failed: ${JSON.stringify(body.error)}`);
  return body.idToken;
}

describe("real verifyIdToken against the Auth emulator", () => {
  it("resolves the uid encoded in a genuine ID token through createContext", async () => {
    const { auth, firestore } = initAdmin({ projectId: PROJECT_ID, dbName: "test" }, "verify-app");
    const config = loadServerConfig();
    const createContext = makeCreateContext({
      firestore,
      config,
      verifyIdToken: createAdminVerifier(auth),
    });
    const idToken = await mintIdToken("real-user-1");

    const ctx = await createContext({
      req: new Request("http://test.local/trpc", {
        headers: { Authorization: `Bearer ${idToken}` },
      }),
    });

    expect(ctx.uid).toBe("real-user-1");
  });

  it("rejects a token whose audience is a different project", async () => {
    const { auth } = initAdmin({ projectId: FOREIGN_PROJECT_ID, dbName: "test" }, "foreign-app");
    const verifyForForeignProject = createAdminVerifier(auth);
    const idToken = await mintIdToken("real-user-2");

    expect(await verifyForForeignProject(idToken)).toBeNull();
  });
});
