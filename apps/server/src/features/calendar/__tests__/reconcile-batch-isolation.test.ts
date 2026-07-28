import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectCalendar, isoDaysFromToday, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcileAll } from "../reconcile";
import { writeGcalAccount } from "../token-store";

const WRITE_CAL = "cal-isolation";

describe("runReconcileAll per-uid isolation", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  const poison = (uid: string) =>
    writeGcalAccount(server.firestore, uid, {
      refreshTokenCipher: "not-a-valid-cipher-payload",
      needsReauth: false,
      connectedAt: server.now(),
      scopeVersion: 1,
      writeCalendarId: "cal-poisoned",
      readCalendarIds: [],
      syncTokens: {},
    });

  it("keeps reconciling healthy uids when another uid faults non-benignly", async () => {
    // Bracket the healthy uid so a poisoned one precedes it under any listConnectedUids order.
    await poison("u-iso-aaa-poison");
    await poison("u-iso-zzz-poison");

    const healthy = "u-iso-healthy";
    await connectCalendar(server, healthy, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, healthy, "t-h", { date: isoDaysFromToday(3), time: "10:00" });

    const result = await runReconcileAll(server.reconcileDeps);

    expect(result.users).toBeGreaterThanOrEqual(3);
    const live = server.google.rawEvents(WRITE_CAL).filter((event) => event.status !== "cancelled");
    expect(live).toHaveLength(1);
  });
});
