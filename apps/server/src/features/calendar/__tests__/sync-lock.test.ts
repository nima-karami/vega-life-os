import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { SyncLockBusyError, withSyncLock } from "../sync-lock";

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

  it("renews the lease so a run outlasting the lease term is never stolen", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = withSyncLock(
      server.firestore,
      "u-heartbeat",
      async () => {
        await gate;
        return "long";
      },
      100,
    );
    // Wait well past the 100ms lease term; the heartbeat must keep it alive.
    await new Promise((resolve) => setTimeout(resolve, 400));

    await expect(
      withSyncLock(server.firestore, "u-heartbeat", async () => "stealer", 100),
    ).rejects.toBeInstanceOf(SyncLockBusyError);

    release();
    expect(await held).toBe("long");

    const reacquired = await withSyncLock(
      server.firestore,
      "u-heartbeat",
      async () => "after",
      100,
    );
    expect(reacquired).toBe("after");
  });
});
