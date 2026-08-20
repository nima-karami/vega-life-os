import { describe, expect, it } from "vitest";
import { describeBounceHint } from "../BrainWriteBounceHint";

describe("describeBounceHint", () => {
  it("explains a card that isn't in spaced repetition", () => {
    expect(describeBounceHint(false, false)).toBe("Not in spaced repetition");
  });

  it("explains a card already reviewed today", () => {
    expect(describeBounceHint(true, true)).toBe("Reviewed today");
  });

  it("has nothing to say about a card that is actually gradeable", () => {
    expect(describeBounceHint(true, false)).toBeNull();
  });
});
