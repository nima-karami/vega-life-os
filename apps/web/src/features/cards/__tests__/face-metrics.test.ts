import { describe, expect, it } from "vitest";
import { composeFace } from "../face/compose";
import { type FaceTextPlan, planFace } from "../face/face-metrics";
import { buildCard } from "./fixtures";

const note = buildCard({
  title: "Second-order thinking",
  body: "And then what? First-order effects are obvious and usually pleasant.",
  category: "Mental models",
});
const vocabulary = buildCard({
  type: "vocabulary",
  title: "saudade",
  phonetic: "/saʊˈdɑdə/",
  body: "A deep longing for something absent that may never return.",
  examples: ["A quiet saudade for the city she left behind."],
  synonyms: ["nostalgia", "yearning"],
});
const quote = buildCard({
  type: "quote",
  title: "Suffering in imagination",
  body: "We suffer more often in imagination than in reality.",
  author: "Seneca",
  work: "Letters to Lucilius, 13",
});

const textItems = (items: ReturnType<typeof planFace>["items"]): FaceTextPlan[] =>
  items.filter((item): item is FaceTextPlan => item.kind !== "rule");

describe("planFace — the drawn metrics at scale 1", () => {
  it("sets the term at 56/600/1 with -.045em and no top margin", () => {
    const [term] = textItems(planFace(composeFace(vocabulary, "face"), 1, false).items);
    expect(term).toMatchObject({
      kind: "term",
      fontSize: 56,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: "-.045em",
      marginTop: 0,
      tone: "ink",
      isMono: false,
    });
  });

  it("sets the pronunciation in mono at 15px muted", () => {
    const mono = textItems(planFace(composeFace(vocabulary, "face"), 1, false).items).at(-1);
    expect(mono).toMatchObject({ kind: "mono", fontSize: 15, tone: "muted", isMono: true });
  });

  it("keeps the rule at 34 wide with 22 above and below", () => {
    const rule = planFace(composeFace(vocabulary, "face"), 1, false).items.find(
      (item) => item.kind === "rule",
    );
    expect(rule).toEqual({ key: "1-rule", kind: "rule", width: 34, marginY: 22 });
  });

  it("gives a lone title 42px and a title that carries a body 34px", () => {
    const solo = textItems(planFace(composeFace(note, "face"), 1, false).items)[0];
    expect(solo).toMatchObject({ fontSize: 42, lineHeight: 1.08, letterSpacing: "-.042em" });

    const withBody = planFace(
      {
        signature: "title-body",
        side: "face",
        typeLabel: "Note",
        category: "Wellbeing",
        blocks: [
          { kind: "title", text: "On rest" },
          { kind: "rule" },
          { kind: "body", text: "Take the break before you need it." },
        ],
      },
      1,
      false,
    );
    expect(textItems(withBody.items)[0]).toMatchObject({
      fontSize: 34,
      lineHeight: 1.12,
      letterSpacing: "-.04em",
    });
    expect(textItems(withBody.items)[1]).toMatchObject({
      fontSize: 17,
      lineHeight: 1.66,
      tone: "ink-secondary",
    });
  });

  it("promotes the reveal's lead to 30px and keeps the remainder at 16", () => {
    const items = textItems(planFace(composeFace(note, "reveal"), 1, false).items);
    expect(items[0]).toMatchObject({ kind: "caps", fontSize: 9, isCaps: true, marginTop: 0 });
    expect(items[1]).toMatchObject({ kind: "lead", fontSize: 30, fontWeight: 500, marginTop: 22 });
    expect(items[2]).toMatchObject({ kind: "body", fontSize: 16, lineHeight: 1.62 });
  });

  it("zeroes the first block's margin and keeps 20 on the trailing synonyms line", () => {
    const items = textItems(planFace(composeFace(vocabulary, "reveal"), 1, false).items);
    expect(items[0]).toMatchObject({ kind: "caps", marginTop: 0 });
    expect(items.at(-1)).toMatchObject({ kind: "caps", marginTop: 20 });
  });

  it("attaches the quotation mark to the quote it sits behind", () => {
    const items = textItems(planFace(composeFace(quote, "face"), 1, false).items);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ kind: "lead", fontSize: 25, fontWeight: 500 });
    expect(items[0].quoteMark).toEqual({ fontSize: 120, top: -46, letterSpacing: "-.05em" });
    expect(items[1].quoteMark).toBeNull();
  });

  it("uses one lead spec per signature — 23px for body & source, 27px for body alone", () => {
    const source = buildCard({
      type: "excerpt",
      body: "A lead sentence here. A remainder there.",
      work: "A Work",
    });
    const alone = buildCard({
      type: "fact",
      body: "A lead sentence here. A remainder there.",
      work: "A Work",
    });
    expect(textItems(planFace(composeFace(source, "face"), 1, false).items)[0]).toMatchObject({
      fontSize: 23,
      fontWeight: 400,
      lineHeight: 1.48,
    });
    expect(textItems(planFace(composeFace(alone, "face"), 1, false).items)[0]).toMatchObject({
      fontSize: 27,
      fontWeight: 500,
      lineHeight: 1.36,
    });
  });

  it("gives the header 9.5px at .06em with a 10px gap", () => {
    expect(planFace(composeFace(note, "face"), 1, false).header).toEqual({
      gap: 10,
      fontSize: 9.5,
      tracking: ".06em",
    });
  });

  it("pads the card at 44/30/44 and the full-bleed feed at 64/30/78", () => {
    expect(planFace(composeFace(note, "face"), 1, false).padding).toEqual({
      top: 44,
      left: 30,
      right: 30,
      bottom: 44,
    });
    expect(planFace(composeFace(note, "face"), 1, true).padding).toEqual({
      top: 64,
      left: 30,
      right: 30,
      bottom: 78,
    });
  });

  it("carries the sample flag onto the planned item", () => {
    const partial = planFace(composeFace(note, "reveal", new Set(["body"] as const)), 1, false);
    const items = textItems(partial.items);
    expect(items.find((item) => item.kind === "caps")?.isSample).toBeUndefined();
    expect(items.find((item) => item.kind === "lead")?.isSample).toBe(true);
    expect(partial.items.filter((item) => item.kind === "rule").some((item) => item.isSample)).toBe(
      false,
    );

    const whole = planFace(
      composeFace(note, "reveal", new Set(["title", "body"] as const)),
      1,
      false,
    );
    expect(
      whole.items.filter((item) => item.kind === "rule").every((item) => item.isSample === true),
    ).toBe(true);
  });
});

describe("planFace — scale is per property", () => {
  it("multiplies every size at the mobile preview scale", () => {
    const plan = planFace(composeFace(vocabulary, "face"), 0.918, false);
    const [term] = textItems(plan.items);
    expect(term.fontSize).toBeCloseTo(51.408, 3);
    expect(term.lineHeight).toBe(1);
    expect(term.letterSpacing).toBe("-.045em");
    expect(plan.header.fontSize).toBeCloseTo(8.721, 3);
    expect(plan.padding.left).toBeCloseTo(27.54, 2);
    expect(plan.padding.right).toBeCloseTo(27.54, 2);
  });

  it("floors small type at 8px on the gallery tile", () => {
    const items = textItems(planFace(composeFace(vocabulary, "reveal"), 0.54, false).items);
    expect(items[0].fontSize).toBe(8);
    expect(items[1].fontSize).toBeCloseTo(11.88, 2);
    expect(planFace(composeFace(vocabulary, "face"), 0.54, false).header.fontSize).toBe(8);
  });

  it("lets floored type break its words so a long term cannot spill the reveal face", () => {
    const term = buildCard({ ...vocabulary, title: "counterrevolutionary" });
    const items = textItems(planFace(composeFace(term, "reveal"), 0.35, false).items);
    expect(items[0]).toMatchObject({ kind: "caps", fontSize: 8, wraps: true });
    expect(items[1].wraps).toBe(true);
  });

  it("leaves type that still has room to shrink unbroken", () => {
    const items = textItems(planFace(composeFace(vocabulary, "reveal"), 1, false).items);
    expect(items.every((item) => item.wraps)).toBe(false);
  });

  it("scales the rule's width and margins but never its thickness", () => {
    const rule = planFace(composeFace(vocabulary, "face"), 0.54, false).items.find(
      (item) => item.kind === "rule",
    );
    expect(rule).toEqual({ key: "1-rule", kind: "rule", width: 18.36, marginY: 11.88 });
  });

  it("scales the quotation mark and its negative offset together", () => {
    const items = textItems(planFace(composeFace(quote, "face"), 0.54, false).items);
    const mark = items[0].quoteMark;
    expect(mark?.fontSize).toBeCloseTo(64.8, 6);
    expect(mark?.top).toBeCloseTo(-24.84, 6);
    expect(mark?.letterSpacing).toBe("-.05em");
  });
});
