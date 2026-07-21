import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCloudProfile, setCloudProfile } = vi.hoisted(() => ({
  getCloudProfile: vi.fn(),
  setCloudProfile: vi.fn(async () => {}),
}));

vi.mock("@/core/firebase/profile", () => ({ getCloudProfile, setCloudProfile }));

import { loadShowGoogleEvents, saveShowGoogleEvents } from "../config";

beforeEach(() => vi.clearAllMocks());

describe("loadShowGoogleEvents", () => {
  it("defaults to true when signed out (no profile read)", async () => {
    expect(await loadShowGoogleEvents(null)).toBe(true);
    expect(getCloudProfile).not.toHaveBeenCalled();
  });

  it("returns true unless the profile explicitly turned it off", async () => {
    getCloudProfile.mockResolvedValueOnce({ gcalShowEvents: undefined });
    expect(await loadShowGoogleEvents("u1")).toBe(true);
    getCloudProfile.mockResolvedValueOnce({ gcalShowEvents: false });
    expect(await loadShowGoogleEvents("u1")).toBe(false);
  });
});

describe("saveShowGoogleEvents", () => {
  it("persists to the cloud profile when signed in", () => {
    saveShowGoogleEvents("u1", false);
    expect(setCloudProfile).toHaveBeenCalledWith({ gcalShowEvents: false });
  });

  it("is a no-op when signed out", () => {
    saveShowGoogleEvents(null, false);
    expect(setCloudProfile).not.toHaveBeenCalled();
  });
});
