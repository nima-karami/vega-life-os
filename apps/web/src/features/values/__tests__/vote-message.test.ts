import { describe, expect, it } from "vitest";
import { buildVoteMessage } from "../vote-message";

describe("buildVoteMessage", () => {
  it("uses the value name verbatim in the headline", () => {
    expect(buildVoteMessage({ name: "Self-care", identity: "" }).headline).toBe(
      "A vote for Self-care",
    );
  });

  it("trims the identity line", () => {
    expect(buildVoteMessage({ name: "Health", identity: "  You move.  " }).identity).toBe(
      "You move.",
    );
  });

  it("treats a blank or whitespace-only identity line as none", () => {
    expect(buildVoteMessage({ name: "Health", identity: "" }).identity).toBeNull();
    expect(buildVoteMessage({ name: "Health", identity: "   " }).identity).toBeNull();
  });

  it("announces the vote alone when there is no identity line", () => {
    expect(buildVoteMessage({ name: "Health", identity: " " }).announcement).toBe(
      "Done. A vote for Health.",
    );
  });

  it("appends the identity line, keeping its own closing punctuation", () => {
    const announce = (identity: string) =>
      buildVoteMessage({ name: "Health", identity }).announcement;
    expect(announce("You're someone who moves.")).toBe(
      "Done. A vote for Health. You're someone who moves.",
    );
    expect(announce("You move")).toBe("Done. A vote for Health. You move.");
    expect(announce("You move!")).toBe("Done. A vote for Health. You move!");
    expect(announce("You move?")).toBe("Done. A vote for Health. You move?");
    expect(announce("You move…")).toBe("Done. A vote for Health. You move…");
  });
});
