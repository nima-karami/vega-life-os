import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/firebase/profile", () => ({ setCloudProfile: vi.fn(async () => {}) }));

import { setCloudProfile } from "@/core/firebase/profile";
import { readLocalQuietMode, saveQuietMode } from "./quiet-mode";

function stubStorage(stored: string | null) {
  const setItem = vi.fn();
  vi.stubGlobal("localStorage", { getItem: () => stored, setItem });
  return setItem;
}

describe("readLocalQuietMode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to on when nothing is stored", () => {
    stubStorage(null);
    expect(readLocalQuietMode()).toBe(true);
  });

  it("reads an explicit off", () => {
    stubStorage("off");
    expect(readLocalQuietMode()).toBe(false);
  });

  it("treats a corrupt value as on", () => {
    stubStorage("maybe");
    expect(readLocalQuietMode()).toBe(true);
  });

  it("falls back to on when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readLocalQuietMode()).toBe(true);
  });
});

describe("saveQuietMode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(setCloudProfile).mockClear();
  });

  it("writes the device flag when signed out", () => {
    const setItem = stubStorage(null);
    saveQuietMode(null, false);
    expect(setItem).toHaveBeenCalledWith("vega.quietMode", "off");
    expect(setCloudProfile).not.toHaveBeenCalled();
  });

  it("writes the cloud profile, not the device, when signed in", () => {
    const setItem = stubStorage(null);
    saveQuietMode("u1", true);
    expect(setCloudProfile).toHaveBeenCalledWith({ quietMode: true });
    expect(setItem).not.toHaveBeenCalled();
  });
});
