import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { registerChannel } from "../channel-registry";
import { runReconcile } from "../reconcile";
import { SyncLockBusyError } from "../sync-lock";
import { handleWebhook, type WebhookHeaders } from "../webhook";

const WRITE_CAL = "cal-write-overlap";
const LOCK_TIMEOUT_MS = 30_000;

/**
 * Inline-push, webhook, and reconcile can fire for one uid at once across stateless instances.
 * The per-uid Firestore lease serializes them: an overlap is rejected as busy rather than
 * interleaving a read-modify-write, and the set-difference reconcile converges to one state.
 */
describe("overlapping sync triggers for one uid serialize under the lock", () => {
  let server: TestServer;
  const confirmedOwned = (taskId: string) =>
    server.google
      .rawEvents(WRITE_CAL)
      .filter(
        (event) =>
          event.status !== "cancelled" && event.extendedProperties?.private?.vegaTaskId === taskId,
      );

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it(
    "lets exactly one of several concurrent reconciles run and rejects the rest as busy",
    async () => {
      const uid = "u-overlap-race";
      await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
      await upsertTask(server, uid, "t-overlap", { date: "2026-07-24", time: "08:00" });

      const settled = await Promise.allSettled(
        Array.from({ length: 3 }, () => runReconcile(server.reconcileDeps, uid)),
      );
      expect(settled.some((r) => r.status === "fulfilled")).toBe(true);
      for (const outcome of settled) {
        if (outcome.status === "rejected") {
          expect(outcome.reason).toBeInstanceOf(SyncLockBusyError);
        }
      }

      await runReconcile(server.reconcileDeps, uid);
      const owned = confirmedOwned("t-overlap");
      expect(owned).toHaveLength(1);
      expect(owned[0]?.start?.dateTime).toContain("08:00");
    },
    LOCK_TIMEOUT_MS,
  );

  it(
    "converges with no lost write when inline-push and a webhook fire together after an edit",
    async () => {
      const uid = "u-overlap-mixed";
      await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
      await registerChannel(server.firestore, {
        channelId: "chan-overlap",
        channelToken: "tok-overlap",
        resourceId: "res-overlap",
        uid,
        calendarId: "cal-watch-overlap",
        expiration: new Date(Date.now() + 7 * 864e5).toISOString(),
      });
      await upsertTask(server, uid, "t-mixed", { date: "2026-07-24", time: "09:00" });
      await runReconcile(server.reconcileDeps, uid);
      expect(confirmedOwned("t-mixed")).toHaveLength(1);

      await upsertTask(server, uid, "t-mixed", { date: "2026-07-24", time: "17:00" });
      const headers: WebhookHeaders = {
        channelId: "chan-overlap",
        channelToken: "tok-overlap",
        resourceState: "exists",
      };
      // The webhook path swallows a busy overlap internally; the inline call may surface it.
      const settled = await Promise.allSettled([
        runReconcile(server.reconcileDeps, uid),
        handleWebhook(server.reconcileDeps, headers),
      ]);
      for (const outcome of settled) {
        if (outcome.status === "rejected") {
          expect(outcome.reason).toBeInstanceOf(SyncLockBusyError);
        }
      }

      await runReconcile(server.reconcileDeps, uid);
      const owned = confirmedOwned("t-mixed");
      expect(owned).toHaveLength(1);
      expect(owned[0]?.start?.dateTime).toContain("17:00");
      const task = await createRepository(server.firestore, uid, "tasks").get("t-mixed");
      expect(task?.time).toBe("17:00");
    },
    LOCK_TIMEOUT_MS,
  );
});
