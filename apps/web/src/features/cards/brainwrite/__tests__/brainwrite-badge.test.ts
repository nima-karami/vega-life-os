import { describe, expect, it } from "vitest";
import { deriveBrainWriteBadgeState } from "../BrainWriteBadge";

describe("deriveBrainWriteBadgeState", () => {
  it("is hidden when the card carries no box", () => {
    expect(deriveBrainWriteBadgeState({ box: null }, false)).toEqual({ kind: "hidden" });
  });

  it("is hidden when the card carries no box, even if marked cleared", () => {
    expect(deriveBrainWriteBadgeState({ box: null }, true)).toEqual({ kind: "hidden" });
  });

  it("is active with the box number when learnable and not cleared today", () => {
    expect(deriveBrainWriteBadgeState({ box: 3 }, false)).toEqual({ kind: "active", box: 3 });
  });

  it("is cleared when learnable and already cleared today", () => {
    expect(deriveBrainWriteBadgeState({ box: 3 }, true)).toEqual({ kind: "cleared" });
  });
});
