import { describe, expect, it } from "vitest";
import { claimVoteToast, formatVoteMessage, VOTE_DESC_MAX } from "../vote-toast";

describe("formatVoteMessage", () => {
  it("names the value alone when it has no desc", () => {
    expect(formatVoteMessage({ name: "Health", desc: "" })).toBe("A vote for Health.");
  });

  it("quotes the desc", () => {
    expect(formatVoteMessage({ name: "Health", desc: "Move daily" })).toBe(
      "A vote for Health: “Move daily”",
    );
  });

  it("truncates a long desc with an ellipsis", () => {
    const message = formatVoteMessage({ name: "Health", desc: "x".repeat(2000) });
    expect(message).toBe(`A vote for Health: “${"x".repeat(VOTE_DESC_MAX)}…”`);
  });

  it("treats a whitespace-only desc as empty", () => {
    expect(formatVoteMessage({ name: "Health", desc: "  \n " })).toBe("A vote for Health.");
  });
});

describe("claimVoteToast", () => {
  it("allows one toast per value per date", () => {
    const seen = new Set<string>();
    expect(claimVoteToast(seen, "v1", "2026-10-20")).toBe(true);
    expect(claimVoteToast(seen, "v1", "2026-10-20")).toBe(false);
    expect(claimVoteToast(seen, "v1", "2026-10-21")).toBe(true);
    expect(claimVoteToast(seen, "v2", "2026-10-20")).toBe(true);
  });
});
