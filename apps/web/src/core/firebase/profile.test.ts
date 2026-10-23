import { describe, expect, it, vi } from "vitest";

const { getDoc } = vi.hoisted(() => ({ getDoc: vi.fn() }));

vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc }));
vi.mock("./app", () => ({ auth: null, loadFirestore: async () => ({}) }));
vi.mock("@/core/persistence/trpc-client", () => ({ getTrpcClient: vi.fn() }));

import { getCloudProfile } from "./profile";

function stubProfileDoc(data: Record<string, unknown>) {
  getDoc.mockResolvedValue({ exists: () => true, data: () => data });
}

describe("getCloudProfile", () => {
  it("keeps well-typed fields and drops mistyped ones", async () => {
    stubProfileDoc({ name: "Nima", workspace: "Home", gcalEnabled: "yes", avatar: 4 });
    const profile = await getCloudProfile("u1");
    expect(profile).toMatchObject({ name: "Nima", workspace: "Home" });
    expect(profile?.gcalEnabled).toBeUndefined();
    expect(profile?.avatar).toBeUndefined();
  });

  it("reads a valid gratitude-nudge watermark and ignores a corrupt one", async () => {
    stubProfileDoc({ gratitudeNudgeAckedThrough: "2026-06-24" });
    expect((await getCloudProfile("u1"))?.gratitudeNudgeAckedThrough).toBe("2026-06-24");

    stubProfileDoc({ gratitudeNudgeAckedThrough: "garbage" });
    expect((await getCloudProfile("u1"))?.gratitudeNudgeAckedThrough).toBeNull();
  });

  it("reads quiet mode as a boolean, leaving it unset when absent or mistyped", async () => {
    stubProfileDoc({ quietMode: false });
    expect((await getCloudProfile("u1"))?.quietMode).toBe(false);

    stubProfileDoc({});
    expect((await getCloudProfile("u1"))?.quietMode).toBeUndefined();

    stubProfileDoc({ quietMode: "no" });
    expect((await getCloudProfile("u1"))?.quietMode).toBeUndefined();
  });
});
