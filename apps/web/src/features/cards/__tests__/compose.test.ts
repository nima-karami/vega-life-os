import { CARD_TYPES, type Card, type SignatureId } from "@vega/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

  it("keeps the face title-only whether the fold comes from the signature or the flag", () => {
    const folded = composeFace(buildCard({ ...note, type: "excerpt" }), "face");
    expect(folded.signature).toBe("title-body");
    expect(folded.blocks).toEqual([{ kind: "title", text: "Second-order thinking" }]);

    const promoted = composeFace(buildCard({ ...note, hasRecall: true }), "face");
    expect(promoted.blocks).toEqual([{ kind: "title", text: "Second-order thinking" }]);
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

const quote = buildCard({
  id: "q1",
  type: "quote",
  category: "Stoicism",
  title: "Suffering in imagination",
  body: "We suffer more often in imagination than in reality.",
  author: "Seneca",
  work: "Letters to Lucilius, 13",
});

const excerpt = buildCard({
  id: "e1",
  type: "excerpt",
  category: "Attention",
  title: "On attending",
  body: "When you attend to something fully you are not simply observing it. You are giving it a portion of your life, which is the one currency that cannot be earned back.",
  work: "Gravity and Grace",
  locator: "p. 92",
});

const fact = buildCard({
  id: "f1",
  type: "fact",
  category: "Biology",
  title: "Bee face recognition",
  body: "Honeybees can recognise individual human faces. They use the same configural processing that people do.",
  work: "Journal of Experimental Biology",
});

describe("composeFace — body & author", () => {
  it("earns the quotation mark from a named author", () => {
    const spec = composeFace(quote, "face");
    expect(spec.signature).toBe("body-author");
    expect(spec.blocks).toEqual([
      { kind: "quoteMark" },
      { kind: "lead", text: "We suffer more often in imagination than in reality." },
      { kind: "rule" },
      { kind: "caps", text: "Seneca" },
      { kind: "body", text: "Letters to Lucilius, 13" },
    ]);
  });

  it("prints UNATTRIBUTED and keeps the rule, without the mark, when no one is named", () => {
    const spec = composeFace(buildCard({ ...quote, author: null }), "face");
    expect(spec.blocks).toEqual([
      { kind: "lead", text: "We suffer more often in imagination than in reality." },
      { kind: "rule" },
      { kind: "caps", text: "UNATTRIBUTED" },
      { kind: "body", text: "Letters to Lucilius, 13" },
    ]);
  });

  it("drops the work line when there is no work", () => {
    const spec = composeFace(buildCard({ ...quote, work: null }), "face");
    expect(spec.blocks.at(-1)).toEqual({ kind: "caps", text: "Seneca" });
  });

  it("prints the quote whole — the lead split does not apply", () => {
    const spec = composeFace(buildCard({ ...quote, body: "One. Two." }), "face");
    expect(spec.blocks[1]).toEqual({ kind: "lead", text: "One. Two." });
  });
});

describe("composeFace — body & source", () => {
  it("folds to the title alone on the face, in the title-body treatment", () => {
    expect(composeFace(excerpt, "face")).toEqual({
      signature: "title-body",
      side: "face",
      typeLabel: "Excerpt",
      category: "Attention",
      blocks: [{ kind: "title", text: "On attending" }],
    });
  });

  it("splits the lead and joins work with locator in one caps line on the reveal", () => {
    const spec = composeFace(excerpt, "reveal");
    expect(spec.signature).toBe("body-source");
    expect(spec.blocks).toEqual([
      {
        kind: "lead",
        text: "When you attend to something fully you are not simply observing it.",
      },
      {
        kind: "body",
        text: "You are giving it a portion of your life, which is the one currency that cannot be earned back.",
      },
      { kind: "rule" },
      { kind: "caps", text: "Gravity and Grace · p. 92" },
    ]);
  });

  it("drops the remainder when the body is one sentence", () => {
    const spec = composeFace(
      buildCard({ ...excerpt, body: "The mind is a fire to be kindled." }),
      "reveal",
    );
    expect(spec.blocks).toEqual([
      { kind: "lead", text: "The mind is a fire to be kindled." },
      { kind: "rule" },
      { kind: "caps", text: "Gravity and Grace · p. 92" },
    ]);
  });

  it("drops both the rule and the citation when there is no work and no locator", () => {
    const spec = composeFace(buildCard({ ...excerpt, work: null, locator: null }), "reveal");
    expect(spec.blocks.map((block) => block.kind)).toEqual(["lead", "body"]);
  });

  it("renders a legacy promoted excerpt exactly as a folded one, on both sides", () => {
    const promoted = buildCard({ ...excerpt, hasRecall: true });
    expect(composeFace(promoted, "face")).toEqual(composeFace(excerpt, "face"));
    expect(composeFace(promoted, "reveal")).toEqual(composeFace(excerpt, "reveal"));
  });

  it("leaves body-alone unfolded, so the fold does not leak to a fact", () => {
    expect(composeFace(fact, "face").blocks[0].kind).toBe("lead");
  });
});

describe("composeFace — body alone", () => {
  it("prints lead, remainder, rule and source", () => {
    const spec = composeFace(fact, "face");
    expect(spec.signature).toBe("body-alone");
    expect(spec.blocks).toEqual([
      { kind: "lead", text: "Honeybees can recognise individual human faces." },
      { kind: "body", text: "They use the same configural processing that people do." },
      { kind: "rule" },
      { kind: "caps", text: "Journal of Experimental Biology" },
    ]);
  });

  it("is a lead and a remainder when there is no source", () => {
    const spec = composeFace(buildCard({ ...fact, work: null }), "face");
    expect(spec.blocks).toEqual([
      { kind: "lead", text: "Honeybees can recognise individual human faces." },
      { kind: "body", text: "They use the same configural processing that people do." },
    ]);
  });

  it("never puts the title on the face", () => {
    const spec = composeFace(fact, "face");
    expect(JSON.stringify(spec.blocks)).not.toContain("Bee face recognition");
  });
});

describe("composeFace — promotion", () => {
  it("gives a promoted card the title alone, in the title-body treatment", () => {
    const spec = composeFace(buildCard({ ...quote, hasRecall: true }), "face");
    expect(spec.signature).toBe("title-body");
    expect(spec.blocks).toEqual([{ kind: "title", text: "Suffering in imagination" }]);
  });

  it("gives the promoted reveal that signature's normal face content", () => {
    const spec = composeFace(buildCard({ ...quote, hasRecall: true }), "reveal");
    expect(spec.signature).toBe("body-author");
    expect(spec.side).toBe("reveal");
    expect(spec.blocks).toEqual([
      { kind: "quoteMark" },
      { kind: "lead", text: "We suffer more often in imagination than in reality." },
      { kind: "rule" },
      { kind: "caps", text: "Seneca" },
      { kind: "body", text: "Letters to Lucilius, 13" },
    ]);
  });

  it("falls back to the face composition when a signature has no reveal of its own", () => {
    expect(composeFace(fact, "reveal").blocks).toEqual(composeFace(fact, "face").blocks);
  });
});

const FIXTURE_TYPE = "recipe";

// Registering a type IS writing this entry — the criterion is that nothing else has to change.
const registry = CARD_TYPES as unknown as Record<
  string,
  { label: string; signature: SignatureId; slots: Record<string, unknown> }
>;

describe("composeFace — a type the shipped registry has never heard of", () => {
  beforeAll(() => {
    registry[FIXTURE_TYPE] = {
      label: "Recipe",
      signature: "title-body",
      slots: {
        title: { label: "Dish", required: true, max: 160 },
        body: { label: "Method", required: true, lines: "tall", max: 600 },
      },
    };
  });

  afterAll(() => {
    Reflect.deleteProperty(registry, FIXTURE_TYPE);
  });

  const recipe = () =>
    buildCard({
      type: FIXTURE_TYPE as Card["type"],
      category: "Mental models",
      title: "Cacio e pepe",
      body: "Salt the water lightly. The cheese brings the rest.",
    });

  it("composes its face from the signature and its label from the entry", () => {
    expect(composeFace(recipe(), "face")).toEqual({
      signature: "title-body",
      side: "face",
      typeLabel: "Recipe",
      category: "Mental models",
      blocks: [{ kind: "title", text: "Cacio e pepe" }],
    });
  });

  it("composes its reveal exactly as any other title-body card", () => {
    expect(composeFace(recipe(), "reveal").blocks).toEqual([
      { kind: "caps", text: "Cacio e pepe" },
      { kind: "lead", text: "Salt the water lightly." },
      { kind: "rule" },
      { kind: "body", text: "The cheese brings the rest." },
    ]);
  });
});

describe("composeFace — sample tagging", () => {
  const noteCard = () =>
    buildCard({
      title: "Second-order thinking",
      body: "And then what? The cost sits further out.",
    });

  const excerptCard = () =>
    buildCard({
      type: "excerpt",
      body: "Attention is the rarest generosity.",
      work: "Gravity and Grace",
      locator: "p. 92",
    });

  it("leaves every block untagged when no sample set is given", () => {
    for (const block of composeFace(noteCard(), "reveal").blocks) {
      expect(block.isSample).toBeUndefined();
    }
  });

  it("tags the block that came from a sampled slot", () => {
    const spec = composeFace(noteCard(), "reveal", new Set(["body"] as const));
    expect(spec.blocks.find((b) => b.kind === "caps")?.isSample).toBeUndefined();
    expect(spec.blocks.find((b) => b.kind === "lead")?.isSample).toBe(true);
  });

  it("ghosts the rules only when the whole face is sample", () => {
    const all = composeFace(noteCard(), "reveal", new Set(["title", "body"] as const));
    expect(all.blocks.filter((b) => b.kind === "rule").every((b) => b.isSample === true)).toBe(
      true,
    );
    const some = composeFace(noteCard(), "reveal", new Set(["body"] as const));
    expect(some.blocks.filter((b) => b.kind === "rule").some((b) => b.isSample === true)).toBe(
      false,
    );
  });

  it("leaves a citation that mixes typed and sampled parts untagged", () => {
    const spec = composeFace(excerptCard(), "reveal", new Set(["locator"] as const));
    expect(spec.blocks.find((b) => b.kind === "caps")?.isSample).toBeUndefined();
  });

  it("tags a citation whose every part is sampled", () => {
    const spec = composeFace(excerptCard(), "reveal", new Set(["work", "locator"] as const));
    expect(spec.blocks.find((b) => b.kind === "caps")?.isSample).toBe(true);
  });

  it("ghosts a folded excerpt title only when the title itself is sampled", () => {
    expect(composeFace(excerptCard(), "face", new Set(["title"] as const)).blocks[0].isSample).toBe(
      true,
    );
    expect(
      composeFace(excerptCard(), "face", new Set(["body"] as const)).blocks[0].isSample,
    ).toBeUndefined();
  });
});
