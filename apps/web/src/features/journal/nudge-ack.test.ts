import { afterEach, describe, expect, it, vi } from "vitest";
import { readLocalGratitudeNudgeAck } from "./nudge-ack";

function stubStoredAck(value: string | null) {
  vi.stubGlobal("localStorage", { getItem: () => value });
}

describe("readLocalGratitudeNudgeAck", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a stored ISO date", () => {
    stubStoredAck("2026-06-24");
    expect(readLocalGratitudeNudgeAck()).toBe("2026-06-24");
  });

  it("ignores a corrupt stored value", () => {
    stubStoredAck("not-a-date");
    expect(readLocalGratitudeNudgeAck()).toBeNull();
  });
});
