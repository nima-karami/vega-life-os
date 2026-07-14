import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { registerChannel } from "../channel-registry";

const WRITE_CAL = "cal-write-replay";
const CHANNEL = { id: "chan-replay", token: "tok-replay" };

/** The webhook only triggers a full set-difference reconcile, so replayed / out-of-order notifications converge. */
describe("webhook replay + out-of-order notifications converge idempotently", () => {
  let server: TestServer;
  const confirmed = () =>
    server.google.rawEvents(WRITE_CAL).filter((event) => event.status !== "cancelled");

  const notify = () =>
    fetch(`${server.url}/webhooks/gcal`, {
      method: "POST",
      headers: {
        "X-Goog-Channel-Id": CHANNEL.id,
        "X-Goog-Channel-Token": CHANNEL.token,
        "X-Goog-Resource-State": "exists",
      },
    });

  beforeAll(async () => {
    server = await bootTestServer();
    await connectCalendar(server, "u-replay", { writeCalendarId: WRITE_CAL });
    await registerChannel(server.firestore, {
      channelId: CHANNEL.id,
      channelToken: CHANNEL.token,
      resourceId: "res-replay",
      uid: "u-replay",
      calendarId: "cal-watch-replay",
      expiration: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
    await upsertTask(server, "u-replay", "t-replay", { date: "2026-07-20", time: "09:00" });
  });
  afterAll(async () => {
    await server.close();
  });

  it("replaying the same notification many times leaves exactly one event (no duplicate create)", async () => {
    for (let i = 0; i < 4; i += 1) {
      const res = await notify();
      expect(res.status).toBe(200);
    }
    expect(confirmed()).toHaveLength(1);
  });

  it("a burst of concurrent notifications still converges to a single consistent event", async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => notify()));
    for (const res of responses) expect(res.status).toBe(200);
    expect(confirmed()).toHaveLength(1);
  });

  it("a stale replay after a later edit does not revert the newer schedule", async () => {
    await upsertTask(server, "u-replay", "t-replay", { date: "2026-07-20", time: "16:00" });
    await notify();
    await notify();

    const event = confirmed()[0];
    expect(event?.start?.dateTime).toContain("16:00");
    const task = await createRepository(server.firestore, "u-replay", "tasks").get("t-replay");
    expect(task?.time).toBe("16:00");
    expect(confirmed()).toHaveLength(1);
  });
});
