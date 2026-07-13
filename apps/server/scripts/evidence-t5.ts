import { createRepository } from "../src/core/repository";
import { hasTombstone } from "../src/core/tombstone";
import {
  listChannelsForUid,
  lookupChannel,
  registerChannel,
} from "../src/features/calendar/channel-registry";
import { type GEvent, toGEvent } from "../src/features/calendar/event-map";
import { runReconcile } from "../src/features/calendar/reconcile";
import { computePullUpdate, computeTaskBatch } from "../src/features/calendar/sync-engine";
import {
  readGcalAccount,
  refreshAccessToken,
  storeConnection,
  TokenRevokedError,
  TransientTokenError,
} from "../src/features/calendar/token-store";
import { handleWebhook } from "../src/features/calendar/webhook";
import { connectCalendar, storedTask, upsertTask } from "../src/test/calendar-fixtures";
import { bootTestServer } from "../src/test/harness";

const log = (line: string) => process.stdout.write(`${line}\n`);
const check = (label: string, ok: boolean) => {
  log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
  if (!ok) throw new Error(`observation failed: ${label}`);
};

async function main(): Promise<void> {
  const server = await bootTestServer();
  const tokenDeps = {
    firestore: server.firestore,
    gateway: server.google.gateway,
    config: server.config,
  };
  log("VEGA t5 — server-side durable Google Calendar sync — runtime observation");
  log(`(real Hono server ${server.url} + Firestore emulator + in-memory Google mock)\n`);

  log("1. Silent access-token refresh (kills the hourly re-login)");
  await storeConnection(
    server.firestore,
    "e-refresh",
    "refresh-e",
    server.config.oauth.tokenEncryptionKey,
    {
      connectedAt: server.now(),
      scopeVersion: 1,
    },
  );
  const token = await refreshAccessToken(tokenDeps, "e-refresh");
  check(
    `minted a fresh access token silently: ${token.slice(0, 12)}…`,
    token.startsWith("access-"),
  );

  log("\n2. Transient (503) vs revoked (invalid_grant) classification");
  server.google.setRefreshBehavior("transient");
  let transient = false;
  try {
    await refreshAccessToken(tokenDeps, "e-refresh");
  } catch (error) {
    transient = error instanceof TransientTokenError;
  }
  check("503 → TransientTokenError (retry, no reconnect prompt)", transient);
  server.google.setRefreshBehavior("revoked");
  let revoked = false;
  try {
    await refreshAccessToken(tokenDeps, "e-refresh");
  } catch (error) {
    revoked = error instanceof TokenRevokedError;
  }
  const revokedAccount = await readGcalAccount(server.firestore, "e-refresh");
  check(
    "invalid_grant → TokenRevokedError → needsReauth set once",
    revoked && revokedAccount?.needsReauth === true,
  );
  server.google.setRefreshBehavior("ok");

  log("\n3. Reconcile keeps a just-moved task (the GCal edit-revert is fixed)");
  await connectCalendar(server, "e-move", { writeCalendarId: "e-cal" });
  await upsertTask(server, "e-move", "t-move", { date: "2026-07-25", time: "09:00" });
  await runReconcile(server.reconcileDeps, "e-move");
  await upsertTask(server, "e-move", "t-move", { date: "2026-07-25", time: "15:00" });
  await runReconcile(server.reconcileDeps, "e-move");
  const moved = await createRepository(server.firestore, "e-move", "tasks").get("t-move");
  const movedEvent = server.google.rawEvents("e-cal").find((e) => e.status !== "cancelled");
  check("task kept at 15:00 (not reverted to the stale Google 09:00)", moved?.time === "15:00");
  check(
    "Google event patched forward to 15:00",
    Boolean(movedEvent?.start?.dateTime?.includes("15:00")),
  );

  log("\n4. Invariant f550ae2 — a live task's aged-out event is never evicted");
  const aged = storedTask({ id: "t-aged", date: "2020-01-01", time: "09:00", status: "todo" });
  const agedEvents: GEvent[] = [{ ...toGEvent(aged), status: "confirmed" }];
  const outsideWindow = computeTaskBatch([aged], agedEvents, () => false);
  check(
    "no delete op for the aged-out event of a still-scheduled task",
    outsideWindow.every((op) => op.kind !== "delete"),
  );

  log("\n5. Invariant 7af64aa — a resolved task is not unscheduled on a cancelled event");
  const doneTask = storedTask({ id: "t-done", date: "2026-07-20", status: "done" });
  const cancelledEvent: GEvent = {
    id: "vega1",
    status: "cancelled",
    extendedProperties: { private: { vegaKey: "task:t-done" } },
  };
  check(
    "cancelled event does not unschedule a done task",
    computePullUpdate(doneTask, cancelledEvent) === null,
  );

  log("\n6. Delete → tombstone, Google counterpart removed, never re-created");
  await connectCalendar(server, "e-del", { writeCalendarId: "e-cal-del" });
  await upsertTask(server, "e-del", "t-del", { date: "2026-07-22", time: "10:00" });
  await runReconcile(server.reconcileDeps, "e-del");
  await createRepository(server.firestore, "e-del", "tasks").remove("t-del");
  check(
    "tombstone written on delete",
    await hasTombstone(server.firestore, "e-del", "tasks", "t-del"),
  );
  await runReconcile(server.reconcileDeps, "e-del");
  await runReconcile(server.reconcileDeps, "e-del");
  const delLive = server.google.rawEvents("e-cal-del").filter((e) => e.status !== "cancelled");
  const delTasks = await createRepository(server.firestore, "e-del", "tasks").list();
  check(
    "Google event removed and task not resurrected by a racing reconcile",
    delLive.length === 0 && delTasks.length === 0,
  );

  log("\n7. Lived lane — external event mirrored, VEGA edit survives an older external update");
  await connectCalendar(server, "e-lived", {
    writeCalendarId: "e-cal-w",
    readCalendarIds: ["e-cal-ext"],
  });
  server.google.seedEvent("e-cal-ext", {
    id: "g-lived-1",
    iCalUID: "ical-lived-1",
    summary: "Standup",
    start: { dateTime: "2026-07-22T09:00:00" },
    end: { dateTime: "2026-07-22T09:30:00" },
    updated: "2026-07-13T08:00:00.000Z",
    status: "confirmed",
  });
  await runReconcile(server.reconcileDeps, "e-lived");
  const mirrorRepo = createRepository(server.firestore, "e-lived", "calendarEvents");
  const mirrored = (await mirrorRepo.list()).find((e) => e.googleId === "g-lived-1");
  check("external event mirrored into calendarEvents", mirrored?.title === "Standup");
  if (mirrored) {
    const { updatedAt: _u, fieldUpdatedAt: _f, ...writable } = mirrored;
    await mirrorRepo.upsert({
      ...writable,
      note: "prep notes",
      vegaEditedAt: "2026-07-13T12:00:00.000Z",
    });
  }
  await runReconcile(server.reconcileDeps, "e-lived");
  const afterEdit = (await mirrorRepo.list()).find((e) => e.googleId === "g-lived-1");
  check(
    "VEGA edit survived + pushed, vegaEditedAt cleared",
    afterEdit?.note === "prep notes" && afterEdit?.vegaEditedAt === null,
  );

  log("\n8. Near-expiry watch channel renewed by reconcile");
  await connectCalendar(server, "e-renew", { writeCalendarId: "e-cal-w2" });
  await registerChannel(server.firestore, {
    channelId: "e-chan-old",
    channelToken: "e-tok",
    resourceId: "e-res",
    uid: "e-renew",
    calendarId: "e-cal-watch",
    expiration: new Date(Date.now() + 864e5).toISOString(),
  });
  const renewResult = await runReconcile(server.reconcileDeps, "e-renew");
  const renewed = await listChannelsForUid(server.firestore, "e-renew");
  check(
    "old channel replaced with a fresh one",
    renewResult.channelsRenewed === 1 &&
      (await lookupChannel(server.firestore, "e-chan-old")) === null &&
      renewed.length === 1 &&
      renewed[0].channelId !== "e-chan-old",
  );

  log(
    "\n9. Webhook: honored for a registered channel, dropped for an unknown one, sync handshake ignored",
  );
  await registerChannel(server.firestore, {
    channelId: "e-wh",
    channelToken: "e-wh-tok",
    resourceId: "e-wh-res",
    uid: "e-move",
    calendarId: "e-cal",
    expiration: new Date(Date.now() + 7 * 864e5).toISOString(),
  });
  const honored = await handleWebhook(server.reconcileDeps, {
    channelId: "e-wh",
    channelToken: "e-wh-tok",
    resourceState: "exists",
  });
  const dropped = await handleWebhook(server.reconcileDeps, {
    channelId: "e-unknown",
    channelToken: "e-wh-tok",
    resourceState: "exists",
  });
  const handshake = await handleWebhook(server.reconcileDeps, {
    channelId: "e-wh",
    channelToken: "e-wh-tok",
    resourceState: "sync",
  });
  check(
    `honored=${honored.outcome}, unknown=${dropped.outcome}, handshake=${handshake.outcome}`,
    honored.outcome === "applied" &&
      dropped.outcome === "dropped" &&
      handshake.outcome === "ignored",
  );

  log("\nAll runtime observations passed.");
  await server.close();
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
