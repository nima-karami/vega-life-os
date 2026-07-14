import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const rulesPath = fileURLToPath(new URL("../../../../../firestore.rules", import.meta.url));

/**
 * Proves the t4 lockdown: with `allow write: if false`, a signed-in client cannot
 * write its own subtree (every write goes through the server), but may still read it.
 */
describe("firestore.rules — client write lockdown (emulator)", () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
    env = await initializeTestEnvironment({
      projectId: "vega-rules-test",
      firestore: { rules: readFileSync(rulesPath, "utf8"), host, port: Number(port) },
    });
  });
  afterAll(async () => {
    await env?.cleanup();
  });

  it("denies a client write under users/{uid}", async () => {
    const client = env.authenticatedContext("u1").firestore();
    await assertFails(setDoc(doc(client, "users/u1/tasks/x"), { title: "nope" }));
  });

  it("allows a client read of its own subtree", async () => {
    await env.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), "users/u1/tasks/x"), { title: "seed" });
    });
    const client = env.authenticatedContext("u1").firestore();
    const snap = await assertSucceeds(getDoc(doc(client, "users/u1/tasks/x")));
    expect(snap.data()?.title).toBe("seed");
  });

  it("denies reading another user's subtree", async () => {
    const client = env.authenticatedContext("u2").firestore();
    await assertFails(getDoc(doc(client, "users/u1/tasks/x")));
  });
});
