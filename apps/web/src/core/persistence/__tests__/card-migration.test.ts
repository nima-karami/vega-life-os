import type { MindCard, MindMetaRecord } from "@vega/shared";
import { describe, expect, it } from "vitest";
import type { VocabEntry } from "@/features/library/model";
import {
  migrateToCards,
  toCardFromMindCard,
  toCardFromVocab,
  toCardPrefs,
} from "../card-migration";

const mindCard = (over: Partial<MindCard> = {}): MindCard => ({
  id: "mc_1",
  title: "Inversion",
  body: "**Solve it backward.**",
  type: "note",
  origin: "manual",
  category: "mental models",
  source: null,
  addedAt: "2026-06-01",
  hiddenAt: null,
  likedAt: null,
  flippable: true,
  box: null,
  lastReviewed: null,
  nextDue: null,
  updatedAt: "2026-06-02T09:00:00.000Z",
  fieldUpdatedAt: { title: "2026-06-02T09:00:00.000Z" },
  ...over,
});

const vocab = (over: Partial<VocabEntry> = {}): VocabEntry => ({
  id: "w1",
  term: "petrichor",
  definition: "The pleasant earthy smell after rain.",
  example: "",
  phonetic: "/ˈpɛtrɪˌkɔr/",
  examples: ["The petrichor rose as the first drops hit."],
  synonyms: [],
  language: "English",
  box: 3,
  lastReviewed: "2026-06-10",
  nextDue: "2026-06-14",
  addedAt: "2026-05-20",
  ...over,
});

const meta = (over: Partial<MindMetaRecord>): MindMetaRecord => ({
  id: "category:focus",
  kind: "category",
  key: "focus",
  value: false,
  setAt: "2026-06-03T08:00:00.000Z",
  updatedAt: "",
  fieldUpdatedAt: {},
  ...over,
});

describe("toCardFromMindCard", () => {
  it("keeps the id, flattens the body and carries the source's stamps", () => {
    const card = toCardFromMindCard(mindCard());
    expect(card.id).toBe("mc_1");
    expect(card.body).toBe("Solve it backward.");
    expect(card.updatedAt).toBe("2026-06-02T09:00:00.000Z");
    expect(card.fieldUpdatedAt).toEqual({ title: "2026-06-02T09:00:00.000Z" });
    expect(card.reviewCount).toBe(0);
  });

  it("falls back to the flattened body, then to Untitled, for an empty title", () => {
    expect(toCardFromMindCard(mindCard({ title: "" })).title).toBe("Solve it backward.");
    expect(toCardFromMindCard(mindCard({ title: "", body: "" })).title).toBe("Untitled");
  });

  it("routes source to author on a quote and to work everywhere else", () => {
    expect(toCardFromMindCard(mindCard({ type: "quote", source: "Seneca" }))).toMatchObject({
      author: "Seneca",
      work: null,
    });
    expect(toCardFromMindCard(mindCard({ type: "note", source: "Poor Charlie" }))).toMatchObject({
      author: null,
      work: "Poor Charlie",
    });
  });

  it("promotes a flippable non-folding card and never a prompt", () => {
    expect(toCardFromMindCard(mindCard({ type: "quote", flippable: true })).hasRecall).toBe(true);
    expect(toCardFromMindCard(mindCard({ type: "note", flippable: true })).hasRecall).toBe(false);
    expect(toCardFromMindCard(mindCard({ type: "prompt", flippable: true })).hasRecall).toBe(false);
  });

  it("carries the review state, and drops it when the result cannot be learned", () => {
    expect(
      toCardFromMindCard(mindCard({ box: 2, lastReviewed: "2026-06-05", nextDue: "2026-06-07" })),
    ).toMatchObject({ box: 2, lastReviewed: "2026-06-05", nextDue: "2026-06-07" });
    expect(
      toCardFromMindCard(
        mindCard({ type: "prompt", flippable: false, box: 2, nextDue: "2026-06-07" }),
      ),
    ).toMatchObject({ box: null, nextDue: null, lastReviewed: null });
  });

  it("leaves the vocabulary-only slots empty", () => {
    expect(toCardFromMindCard(mindCard())).toMatchObject({
      phonetic: null,
      language: null,
      locator: null,
      examples: [],
      synonyms: [],
    });
  });
});

describe("toCardFromVocab", () => {
  it("maps a word onto a vocabulary card in the Language category", () => {
    const card = toCardFromVocab(vocab(), []);
    expect(card).toMatchObject({
      id: "w1",
      type: "vocabulary",
      category: "Language",
      title: "petrichor",
      body: "The pleasant earthy smell after rain.",
      phonetic: "/ˈpɛtrɪˌkɔr/",
      language: "English",
      box: 3,
      lastReviewed: "2026-06-10",
      nextDue: "2026-06-14",
      addedAt: "2026-05-20",
      hasRecall: false,
      reviewCount: 0,
      author: null,
      work: null,
      locator: null,
    });
    expect(card.examples).toEqual(["The petrichor rose as the first drops hit."]);
  });

  it("folds the legacy singular example in", () => {
    const card = toCardFromVocab(vocab({ examples: [], example: "A legacy sentence." }), []);
    expect(card.examples).toEqual(["A legacy sentence."]);
  });

  it("reads hidden and liked off the derived mindMeta rows", () => {
    const card = toCardFromVocab(vocab(), [
      meta({ id: "hide:d:vocab:w1", kind: "hide", key: "d:vocab:w1", value: true }),
      meta({ id: "like:d:vocab:w1", kind: "like", key: "d:vocab:w1", value: true }),
    ]);
    expect(card.hiddenAt).toBe("2026-06-03T08:00:00.000Z");
    expect(card.likedAt).toBe("2026-06-03T08:00:00.000Z");
  });

  it("ignores a hide row that was turned back off", () => {
    const card = toCardFromVocab(vocab(), [
      meta({ id: "hide:d:vocab:w1", kind: "hide", key: "d:vocab:w1", value: false }),
    ]);
    expect(card.hiddenAt).toBeNull();
  });

  it("caps the arrays at the registry's limits", () => {
    const card = toCardFromVocab(
      vocab({ examples: Array(9).fill("an example"), synonyms: Array(20).fill("word") }),
      [],
    );
    expect(card.examples).toHaveLength(5);
    expect(card.synonyms).toHaveLength(12);
  });
});

describe("toCardPrefs", () => {
  it("inverts disabled categories into an include list", () => {
    const prefs = toCardPrefs(
      [meta({ key: "focus", value: false })],
      ["focus", "Language", "mental models"],
    );
    expect(prefs.categories).toEqual(["Language", "mental models"]);
  });

  it("leaves the include list empty when nothing was disabled", () => {
    expect(toCardPrefs([meta({ key: "focus", value: true })], ["focus"]).categories).toEqual([]);
    expect(toCardPrefs([], ["focus"]).categories).toEqual([]);
  });

  it("turns a disabled vocab source into every type except vocabulary", () => {
    const prefs = toCardPrefs(
      [meta({ id: "source:vocab", kind: "source", key: "vocab", value: false })],
      [],
    );
    expect(prefs.types).toEqual(["note", "quote", "excerpt", "fact", "prompt"]);
  });

  it("defaults to mix and rows with nothing filtered", () => {
    expect(toCardPrefs([], [])).toMatchObject({
      id: "feed",
      mode: "mix",
      view: "rows",
      types: [],
      categories: [],
    });
  });
});

describe("migrateToCards", () => {
  it("converts both sources, keeps every id and reports nothing skipped", () => {
    const result = migrateToCards({
      mindCards: [mindCard(), mindCard({ id: "mc_2", title: "Second-order" })],
      mindMeta: [],
      vocab: [vocab(), vocab({ id: "w2", term: "saudade", definition: "A longing." })],
    });
    expect(result.cards.map((c) => c.id)).toEqual(["mc_1", "mc_2", "w1", "w2"]);
    expect(result.skipped).toEqual([]);
  });

  it("is idempotent — the same sources produce the same rows", () => {
    const sources = { mindCards: [mindCard()], mindMeta: [], vocab: [vocab()] };
    expect(migrateToCards(sources).cards).toEqual(migrateToCards(sources).cards);
  });

  it("skips a record that cannot make a valid card and names it", () => {
    const result = migrateToCards({
      mindCards: [],
      mindMeta: [],
      vocab: [vocab({ id: "w_broken", definition: "" })],
    });
    expect(result.cards).toEqual([]);
    expect(result.skipped).toEqual(["w_broken"]);
  });

  it("names every card whose review schedule the conversion ended", () => {
    const result = migrateToCards({
      mindCards: [
        mindCard({ box: 2, lastReviewed: "2026-06-05", nextDue: "2026-06-07" }),
        mindCard({
          id: "mc_prompt",
          type: "prompt",
          flippable: true,
          box: 2,
          lastReviewed: "2026-06-05",
          nextDue: "2026-06-07",
        }),
      ],
      mindMeta: [],
      vocab: [vocab()],
    });
    expect(result.cards.find((c) => c.id === "mc_prompt")).toMatchObject({
      box: null,
      nextDue: null,
      lastReviewed: null,
    });
    expect(result.endedSchedules).toEqual(["mc_prompt"]);
  });

  it("reports nothing ended when every schedule survives", () => {
    expect(
      migrateToCards({ mindCards: [mindCard()], mindMeta: [], vocab: [vocab()] }).endedSchedules,
    ).toEqual([]);
  });

  it("derives the include list from the categories the migrated cards actually use", () => {
    const result = migrateToCards({
      mindCards: [mindCard({ category: "focus" })],
      mindMeta: [meta({ key: "focus", value: false })],
      vocab: [vocab()],
    });
    expect(result.prefs.categories).toEqual(["Language"]);
  });
});
