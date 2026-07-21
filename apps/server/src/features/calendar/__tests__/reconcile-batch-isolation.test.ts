import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
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

  it("keeps reconciling healthy uids when another uid faults non-benignly", async () => {
    const poisoned = "u-poisoned";
    await writeGcalAccount(server.firestore, poisoned, {
      refreshTokenCipher: "not-a-valid-cipher-payload",
      needsReauth: false,
      connectedAt: server.now(),
      scopeVersion: 1,
      writeCalendarId: "cal-poisoned",
      readCalendarIds: [],
      syncTokens: {},
    });

    const healthy = "u-healthy";
    await connectCalendar(server, healthy, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, healthy, "t-h", { date: "2026-08-12", time: "10:00" });

    const result = await runReconcileAll(server.reconcileDeps);

    expect(result.users).toBeGreaterThanOrEqual(2);
    const live = server.google.rawEvents(WRITE_CAL).filter((event) => event.status !== "cancelled");
    expect(live).toHaveLength(1);
  });
});
