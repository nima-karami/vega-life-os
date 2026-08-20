import { describe, expect, it } from "vitest";
import { deriveStudyBadgeState } from "../StudyBadge";

describe("deriveStudyBadgeState", () => {
  it("is hidden when the card carries no box", () => {
    expect(deriveStudyBadgeState({ box: null }, false)).toEqual({ kind: "hidden" });
  });

  it("is hidden when the card carries no box, even if marked cleared", () => {
    expect(deriveStudyBadgeState({ box: null }, true)).toEqual({ kind: "hidden" });
  });

  it("is active with the box number when learnable and not cleared today", () => {
    expect(deriveStudyBadgeState({ box: 3 }, false)).toEqual({ kind: "active", box: 3 });
  });

  it("is cleared when learnable and already cleared today", () => {
    expect(deriveStudyBadgeState({ box: 3 }, true)).toEqual({ kind: "cleared" });
  });
});
