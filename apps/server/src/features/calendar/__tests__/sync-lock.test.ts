import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { SyncLockBusyError, type SyncLockTiming, withSyncLock } from "../sync-lock";

const LEASE_MS = 30_000;

describe("per-uid sync lock (Firestore lease)", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("runs the critical section and releases the lease afterwards", async () => {
    const value = await withSyncLock(server.firestore, "u-lock", async () => "done");
    expect(value).toBe("done");
    const again = await withSyncLock(server.firestore, "u-lock", async () => "reacquired");
    expect(again).toBe("reacquired");
  });

  it("rejects an overlapping acquire for the same uid while held", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = withSyncLock(server.firestore, "u-busy", async () => {
      await gate;
      return "first";
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect(
      withSyncLock(server.firestore, "u-busy", async () => "second"),
    ).rejects.toBeInstanceOf(SyncLockBusyError);

    release();
    expect(await held).toBe("first");
  });

  it("lets an expired lease be stolen when nothing renews it", async () => {
    const clock = buildManualClock();
    const { gate, release } = buildGate();
    const held = withSyncLock(
      server.firestore,
      "u-expired",
      async () => {
        await gate;
        return "stale";
      },
      { now: clock.now, startHeartbeat: () => () => {} },
    );
    await waitForLease("u-expired");

    clock.advance(LEASE_MS + 1);
    const stolen = await withSyncLock(server.firestore, "u-expired", async () => "stealer", {
      now: clock.now,
      startHeartbeat: () => () => {},
    });
    expect(stolen).toBe("stealer");

    release();
    expect(await held).toBe("stale");
  });

  it("renews the lease so a run outlasting the lease term is never stolen", async () => {
    const clock = buildManualClock();
    const heartbeat = { renew: async () => {}, intervalMs: 0, isStarted: false, isStopped: false };
    const timing: Partial<SyncLockTiming> = {
      now: clock.now,
      startHeartbeat: (renew, intervalMs) => {
        Object.assign(heartbeat, { renew, intervalMs, isStarted: true });
        return () => {
          heartbeat.isStopped = true;
        };
      },
    };
    const { gate, release } = buildGate();
    const held = withSyncLock(
      server.firestore,
      "u-heartbeat",
      async () => {
        await gate;
        return "long";
      },
      timing,
    );
    await vi.waitFor(() => expect(heartbeat.isStarted).toBe(true));
    expect(heartbeat.intervalMs).toBe(LEASE_MS / 3);

    // Two beats carry the lease past its first term; unrenewed it would have expired at LEASE_MS.
    clock.advance(LEASE_MS / 3);
    await heartbeat.renew();
    clock.advance(LEASE_MS / 3);
    await heartbeat.renew();
    clock.advance(LEASE_MS / 2);

    await expect(
      withSyncLock(server.firestore, "u-heartbeat", async () => "stealer", { now: clock.now }),
    ).rejects.toBeInstanceOf(SyncLockBusyError);

    release();
    expect(await held).toBe("long");
    expect(heartbeat.isStopped).toBe(true);

    const reacquired = await withSyncLock(server.firestore, "u-heartbeat", async () => "after", {
      now: clock.now,
      startHeartbeat: () => () => {},
    });
    expect(reacquired).toBe("after");
  });

  function buildManualClock() {
    let nowMs = Date.UTC(2030, 0, 1);
    return {
      now: () => nowMs,
      advance: (ms: number) => {
        nowMs += ms;
      },
    };
  }

  function buildGate() {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { gate, release };
  }

  async function waitForLease(uid: string) {
    const ref = server.firestore.doc(`users/${uid}/private/syncLock`);
    await vi.waitFor(async () => expect((await ref.get()).exists).toBe(true));
  }
});
