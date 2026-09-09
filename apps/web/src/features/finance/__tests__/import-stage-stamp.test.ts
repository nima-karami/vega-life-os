import { describe, expect, it } from "vitest";
import { advanceStamp, isStampLive, type StageStamp } from "../import-stage-stamp";

const FIRST: StageStamp = { accountId: "acct_a", selection: 0 };

describe("advanceStamp", () => {
  it("keeps the same stamp while the account holds", () => {
    expect(advanceStamp(FIRST, "acct_a")).toBe(FIRST);
  });

  it("counts every move, so returning is not the same selection as never leaving", () => {
    const away = advanceStamp(FIRST, "acct_b");
    const back = advanceStamp(away, "acct_a");

    expect(back).toEqual({ accountId: "acct_a", selection: 2 });
  });

  it("treats a cleared account as a move of its own", () => {
    expect(advanceStamp(FIRST, null)).toEqual({ accountId: null, selection: 1 });
  });
});

describe("isStampLive", () => {
  it("lets a parse land when the account never moved", () => {
    expect(isStampLive(FIRST, advanceStamp(FIRST, "acct_a"))).toBe(true);
  });

  it("discards a parse whose account was left", () => {
    expect(isStampLive(FIRST, advanceStamp(FIRST, "acct_b"))).toBe(false);
  });

  it("discards a parse the user left and came back to", () => {
    const live = advanceStamp(advanceStamp(FIRST, "acct_b"), "acct_a");

    expect(isStampLive(FIRST, live)).toBe(false);
  });
});
