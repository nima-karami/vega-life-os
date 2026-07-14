import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectCalendar } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";
import {
  listConnectedUids,
  readGcalAccount,
  refreshAccessToken,
  TokenRevokedError,
  TransientTokenError,
} from "../token-store";

const WRITE_CAL = "cal-write-classify";

/** Transient faults retry silently forever; a revocation prompts for reauth exactly once. */
describe("token classification: transient backoff vs revoked reauth", () => {
  let server: TestServer;
  const tokenDeps = () => ({
    firestore: server.firestore,
    gateway: server.google.gateway,
    config: server.config,
  });

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
    server.google.setRefreshBehavior("ok");
  });

  it("classifies repeated 503s as transient across many attempts and never flips needsReauth", async () => {
    const uid = "u-transient-x";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    server.google.setRefreshBehavior("transient");

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(refreshAccessToken(tokenDeps(), uid)).rejects.toBeInstanceOf(
        TransientTokenError,
      );
      const account = await readGcalAccount(server.firestore, uid);
      expect(account?.needsReauth).toBe(false);
    }
    server.google.setRefreshBehavior("ok");
  });

  it("surfaces invalid_grant as GCAL_NEEDS_REAUTH once, then skips the uid instead of re-prompting", async () => {
    const uid = "u-revoked-once";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    server.google.setRefreshBehavior("revoked");

    await expect(refreshAccessToken(tokenDeps(), uid)).rejects.toBeInstanceOf(TokenRevokedError);
    expect((await readGcalAccount(server.firestore, uid))?.needsReauth).toBe(true);

    // Once flagged the uid drops out of the scheduler's fan-out and reconcile short-circuits,
    // so no second refresh (and no second prompt) is ever attempted.
    expect(await listConnectedUids(server.firestore)).not.toContain(uid);
    const result = await runReconcile(server.reconcileDeps, uid);
    expect(result).toMatchObject({ pushed: 0, pulled: 0, pushFailures: 0 });
    server.google.setRefreshBehavior("ok");
  });
});
