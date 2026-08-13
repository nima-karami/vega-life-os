import { describe, expect, it } from "vitest";
import { describeModeMeta, describeShowAction } from "../feed-control-copy";

describe("describeModeMeta", () => {
  it("prints the size of the due set beside the due row", () => {
    expect(describeModeMeta("due", 12)).toBe("12 CARDS");
    expect(describeModeMeta("due", 1)).toBe("1 CARD");
  });

  it("prints how many of the mixed feed are due beside the mix row", () => {
    expect(describeModeMeta("mix", 12)).toBe("12 DUE");
    expect(describeModeMeta("mix", 1)).toBe("1 DUE");
  });

  it("says the same qualitative thing on both rows when nothing is due", () => {
    expect(describeModeMeta("due", 0)).toBe("NOTHING DUE");
    expect(describeModeMeta("mix", 0)).toBe("NOTHING DUE");
  });

  it("is always qualitative on the read row", () => {
    expect(describeModeMeta("read", 0)).toBe("NOTHING GRADED");
    expect(describeModeMeta("read", 12)).toBe("NOTHING GRADED");
  });
});

describe("describeShowAction", () => {
  it("names the result count, agreeing with it", () => {
    expect(describeShowAction(48)).toBe("Show 48 cards");
    expect(describeShowAction(1)).toBe("Show 1 card");
  });

  it("stays qualitative at zero rather than printing 0 cards", () => {
    expect(describeShowAction(0)).toBe("Show nothing");
  });
});
