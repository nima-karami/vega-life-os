import { describe, expect, it } from "vitest";
import { deriveBrainIconState } from "../FeedActionRail";

describe("deriveBrainIconState", () => {
  it("maps every feedStep output to an IconState", () => {
    expect(deriveBrainIconState("open")).toBe("disabled");
    expect(deriveBrainIconState("folded")).toBe("inactive");
    expect(deriveBrainIconState("graded")).toBe("active");
  });
});
