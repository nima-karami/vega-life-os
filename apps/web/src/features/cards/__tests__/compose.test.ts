import { describe, expect, it } from "vitest";
import { splitLead } from "../face/compose";

describe("splitLead", () => {
  it("promotes the first sentence and drops the remainder below", () => {
    expect(
      splitLead(
        "And then what? First-order effects are obvious and usually pleasant. Second-order effects are delayed.",
      ),
    ).toEqual({
      lead: "And then what?",
      remainder:
        "First-order effects are obvious and usually pleasant. Second-order effects are delayed.",
    });
  });

  it("keeps a single sentence whole and leaves no remainder", () => {
    expect(splitLead("The mind is not a vessel to be filled, but a fire to be kindled.")).toEqual({
      lead: "The mind is not a vessel to be filled, but a fire to be kindled.",
      remainder: "",
    });
  });

  it("returns the whole body as the lead when there is no sentence break", () => {
    expect(splitLead("Honeybees can recognise individual human faces")).toEqual({
      lead: "Honeybees can recognise individual human faces",
      remainder: "",
    });
  });

  it("splits on a paragraph break that arrives before any terminator", () => {
    expect(splitLead("A line with no stop\n\nA second paragraph.")).toEqual({
      lead: "A line with no stop",
      remainder: "A second paragraph.",
    });
  });

  it("splits at the terminator when it arrives before the paragraph break", () => {
    expect(splitLead("First. Second\n\nThird.")).toEqual({
      lead: "First.",
      remainder: "Second\n\nThird.",
    });
  });

  it("splits after a closing quotation mark", () => {
    expect(splitLead('He said "stop." Then he left.')).toEqual({
      lead: 'He said "stop."',
      remainder: "Then he left.",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(splitLead("  Lead here.   Rest here.  ")).toEqual({
      lead: "Lead here.",
      remainder: "Rest here.",
    });
  });

  it("returns two empty strings for an empty body", () => {
    expect(splitLead("   ")).toEqual({ lead: "", remainder: "" });
  });
});
