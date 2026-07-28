import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, isoDaysFromToday, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { listChannelsForUid, lookupChannel, registerChannel } from "../channel-registry";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-cycle";

describe("full reconcile cycle (both lanes, lock, channel renewal, OIDC endpoint)", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("keeps a just-moved task and pushes the new time (the edit-revert bug is fixed)", async () => {
    const uid = "u-cycle";
    const scheduledDate = isoDaysFromToday(2);
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-move", { date: scheduledDate, time: "09:00" });
    await runReconcile(server.reconcileDeps, uid);

    await upsertTask(server, uid, "t-move", { date: scheduledDate, time: "15:00" });
    const result = await runReconcile(server.reconcileDeps, uid);

    const task = await createRepository(server.firestore, uid, "tasks").get("t-move");
    expect(task?.time).toBe("15:00");
    const event = server.google
      .rawEvents(WRITE_CAL)
      .find((candidate) => candidate.status !== "cancelled");
    expect(event?.start?.dateTime).toContain("15:00");
    expect(result.pushed).toBeGreaterThanOrEqual(1);
  });

  it("renews a watch channel within two days of expiry", async () => {
    const uid = "u-renew";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await registerChannel(server.firestore, {
      channelId: "chan-old",
      channelToken: "tok-old",
      resourceId: "res-old",
      uid,
      calendarId: "cal-watch",
      expiration: new Date(Date.now() + 864e5).toISOString(),
    });

    const result = await runReconcile(server.reconcileDeps, uid);
    expect(result.channelsRenewed).toBe(1);
    expect(await lookupChannel(server.firestore, "chan-old")).toBeNull();

    const watchChannels = (await listChannelsForUid(server.firestore, uid)).filter(
      (channel) => channel.calendarId === "cal-watch",
    );
    expect(watchChannels).toHaveLength(1);
    expect(watchChannels[0].channelId).not.toBe("chan-old");
    expect(server.google.channelsForCalendar("cal-watch")).toHaveLength(1);
  });

  it("guards POST /tasks/reconcile behind the Scheduler OIDC token", async () => {
    const denied = await fetch(`${server.url}/tasks/reconcile`, { method: "POST" });
    expect(denied.status).toBe(401);

    const allowed = await fetch(`${server.url}/tasks/reconcile`, {
      method: "POST",
      headers: { Authorization: "Bearer scheduler-oidc" },
    });
    expect(allowed.status).toBe(200);
    const body = (await allowed.json()) as { users: number };
    expect(body.users).toBeGreaterThanOrEqual(1);
  });
});
