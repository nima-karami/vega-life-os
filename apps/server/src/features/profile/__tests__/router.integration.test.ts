import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootTestServer, type TestServer } from "../../../test/harness";

describe("profile router (real server vs emulator)", () => {
  let server: TestServer;
  const owner = "profile-owner";

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("merge-patches the users/{uid} profile doc via Admin", async () => {
    await server.asUid(owner).profile.upsert.mutate({ name: "Nima", gcalEnabled: true });
    await server.asUid(owner).profile.upsert.mutate({ workspace: "VEGA" });

    const snap = await server.firestore.doc(`users/${owner}`).get();
    expect(snap.data()).toMatchObject({ name: "Nima", gcalEnabled: true, workspace: "VEGA" });
  });

  it("stores and clears the gratitude-nudge acknowledgement watermark", async () => {
    await server.asUid(owner).profile.upsert.mutate({ gratitudeNudgeAckedThrough: "2026-06-24" });
    let snap = await server.firestore.doc(`users/${owner}`).get();
    expect(snap.data()?.gratitudeNudgeAckedThrough).toBe("2026-06-24");

    await server.asUid(owner).profile.upsert.mutate({ gratitudeNudgeAckedThrough: null });
    snap = await server.firestore.doc(`users/${owner}`).get();
    expect(snap.data()?.gratitudeNudgeAckedThrough).toBeNull();
  });

  it("stores the quiet-mode preference", async () => {
    await server.asUid(owner).profile.upsert.mutate({ quietMode: false });
    const snap = await server.firestore.doc(`users/${owner}`).get();
    expect(snap.data()?.quietMode).toBe(false);
  });

  it("strips an unknown field rather than rejecting", async () => {
    await server.asUid(owner).profile.upsert.mutate({ avatar: "a.png", bogus: 1 } as never);
    const snap = await server.firestore.doc(`users/${owner}`).get();
    expect(snap.data()?.avatar).toBe("a.png");
    expect(snap.data()).not.toHaveProperty("bogus");
  });

  it("scopes the write to the caller's uid", async () => {
    await server.asUid("profile-stranger").profile.upsert.mutate({ name: "Stranger" });
    const owned = await server.firestore.doc(`users/${owner}`).get();
    expect(owned.data()?.name).toBe("Nima");
  });

  it("rejects an unauthenticated write with UNAUTHORIZED", async () => {
    await expect(server.call.profile.upsert.mutate({ name: "nope" })).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED" },
    });
  });
});
