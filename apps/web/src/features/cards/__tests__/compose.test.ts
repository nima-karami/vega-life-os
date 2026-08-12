import { describe, expect, it } from "vitest";
import { composeFace, splitLead } from "../face/compose";
import { buildCard } from "./fixtures";

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

const note = buildCard({
  title: "Second-order thinking",
  body: "And then what? First-order effects are obvious and usually pleasant.",
  category: "Mental models",
});

const vocabulary = buildCard({
  id: "w1",
  type: "vocabulary",
  category: "Language",
  title: "saudade",
  phonetic: "/saʊˈdɑdə/",
  language: "Portuguese",
  body: "A deep longing for something absent that may never return.",
  examples: ["A quiet saudade for the city she left behind."],
  synonyms: ["nostalgia", "yearning", "wistfulness"],
});

describe("composeFace — term & gloss", () => {
  it("gives the face the term and the pronunciation, separated by the rule", () => {
    const spec = composeFace(vocabulary, "face");
    expect(spec.signature).toBe("term-gloss");
    expect(spec.side).toBe("face");
    expect(spec.typeLabel).toBe("Vocabulary");
    expect(spec.category).toBe("Language");
    expect(spec.blocks).toEqual([
      { kind: "term", text: "saudade" },
      { kind: "rule" },
      { kind: "mono", text: "/saʊˈdɑdə/" },
    ]);
  });

  it("drops the rule with the pronunciation when there is none", () => {
    const spec = composeFace(buildCard({ ...vocabulary, phonetic: null }), "face");
    expect(spec.blocks).toEqual([{ kind: "term", text: "saudade" }]);
  });

  it("gives the reveal the demoted term, the definition, the first example and the synonyms", () => {
    const spec = composeFace(vocabulary, "reveal");
    expect(spec.side).toBe("reveal");
    expect(spec.blocks).toEqual([
      { kind: "caps", text: "saudade" },
      { kind: "lead", text: "A deep longing for something absent that may never return." },
      { kind: "rule" },
      { kind: "body", text: "A quiet saudade for the city she left behind." },
      { kind: "caps", text: "nostalgia · yearning · wistfulness" },
    ]);
  });

  it("prints the definition whole — the lead split does not apply to term & gloss", () => {
    const spec = composeFace(
      buildCard({ ...vocabulary, body: "One sentence. And a second one.", examples: [] }),
      "reveal",
    );
    expect(spec.blocks).toEqual([
      { kind: "caps", text: "saudade" },
      { kind: "lead", text: "One sentence. And a second one." },
      { kind: "caps", text: "nostalgia · yearning · wistfulness" },
    ]);
  });

  it("drops the synonyms line when there are none", () => {
    const spec = composeFace(buildCard({ ...vocabulary, synonyms: [] }), "reveal");
    expect(spec.blocks.at(-1)).toEqual({
      kind: "body",
      text: "A quiet saudade for the city she left behind.",
    });
  });
});

describe("composeFace — title & body", () => {
  it("folds to the title alone on the face", () => {
    const spec = composeFace(note, "face");
    expect(spec.signature).toBe("title-body");
    expect(spec.blocks).toEqual([{ kind: "title", text: "Second-order thinking" }]);
  });

  it("prints title, rule and body when nothing is withheld", () => {
    const spec = composeFace(buildCard({ ...note, type: "excerpt" }), "face");
    expect(spec.signature).toBe("body-source");

    // The open title-body composition is reached by composing a card that has no reveal.
    const spec2 = composeFace(buildCard({ ...note, hasRecall: false }), "face");
    expect(spec2.blocks).toEqual([{ kind: "title", text: "Second-order thinking" }]);
  });

  it("promotes the body's first sentence above the rule on the reveal", () => {
    const spec = composeFace(note, "reveal");
    expect(spec.blocks).toEqual([
      { kind: "caps", text: "Second-order thinking" },
      { kind: "lead", text: "And then what?" },
      { kind: "rule" },
      { kind: "body", text: "First-order effects are obvious and usually pleasant." },
    ]);
  });

  it("drops the rule on the reveal when the body has no remainder", () => {
    const spec = composeFace(buildCard({ ...note, body: "Ask and then what?" }), "reveal");
    expect(spec.blocks).toEqual([
      { kind: "caps", text: "Second-order thinking" },
      { kind: "lead", text: "Ask and then what?" },
    ]);
  });

  it("carries an empty category through untouched", () => {
    expect(composeFace(buildCard({ ...note, category: "  " }), "face").category).toBe("");
  });
});
