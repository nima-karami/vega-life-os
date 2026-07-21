import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectCalendar } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";
import { readGcalAccount } from "../token-store";

describe("profile→account read-calendar migration", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("moves gcalReadCalendarIds from the profile doc into the account once, idempotently", async () => {
    const uid = "u-migrate";
    await connectCalendar(server, uid, { writeCalendarId: "cal-w-mig" });
    await server.firestore
      .doc(`users/${uid}`)
      .set({ gcalReadCalendarIds: ["cal-legacy-a", "cal-legacy-b"] }, { merge: true });
    await runReconcile(server.reconcileDeps, uid);
    await runReconcile(server.reconcileDeps, uid); // second run must be a no-op

    const account = await readGcalAccount(server.firestore, uid);
    expect(account?.readCalendarIds).toEqual(["cal-legacy-a", "cal-legacy-b"]);
    const profile = (await server.firestore.doc(`users/${uid}`).get()).data() ?? {};
    expect(profile.gcalReadCalendarIds).toBeUndefined();
  });
});
