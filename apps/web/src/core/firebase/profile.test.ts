import { describe, expect, it, vi } from "vitest";

const { getDoc } = vi.hoisted(() => ({ getDoc: vi.fn() }));

vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc }));
vi.mock("./app", () => ({ auth: null, db: {} }));
vi.mock("@/core/persistence/trpc-client", () => ({ getTrpcClient: vi.fn() }));

import { getCloudProfile } from "./profile";

function stubProfileDoc(data: Record<string, unknown>) {
  getDoc.mockResolvedValue({ exists: () => true, data: () => data });
}

describe("getCloudProfile", () => {
  it("keeps well-typed fields and drops mistyped ones", async () => {
    stubProfileDoc({ name: "Nima", streakGraceDays: 2, gcalEnabled: "yes", avatar: 4 });
    const profile = await getCloudProfile("u1");
    expect(profile).toMatchObject({ name: "Nima", streakGraceDays: 2 });
    expect(profile?.gcalEnabled).toBeUndefined();
    expect(profile?.avatar).toBeUndefined();
  });

  it("reads a valid gratitude-nudge watermark and ignores a corrupt one", async () => {
    stubProfileDoc({ gratitudeNudgeAckedThrough: "2026-06-24" });
    expect((await getCloudProfile("u1"))?.gratitudeNudgeAckedThrough).toBe("2026-06-24");

    stubProfileDoc({ gratitudeNudgeAckedThrough: "garbage" });
    expect((await getCloudProfile("u1"))?.gratitudeNudgeAckedThrough).toBeNull();
  });
});
