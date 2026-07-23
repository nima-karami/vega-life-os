import type { MindCard, MindMetaRecord, VocabEntry } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildAuthoredFeedCards, buildFeedPool, buildVocabFeedCards } from "../feed-cards";
import { metaId } from "../model";

const TODAY = "2026-07-22";

const card = (over: Partial<MindCard> = {}): MindCard => ({
  id: over.id ?? "mc_1",
  title: "",
  body: "",
  category: "",
  source: null,
  addedAt: "2026-07-01",
  hiddenAt: null,
  box: null,
  lastReviewed: null,
  nextDue: null,
  updatedAt: "",
  fieldUpdatedAt: {},
  ...over,
});

const entry = (over: Partial<VocabEntry> = {}): VocabEntry => ({
  id: over.id ?? "v1",
  term: "hola",
  definition: "hello",
  example: "hola amigo",
  language: "es",
  box: 1,
  lastReviewed: null,
  nextDue: null,
  addedAt: "2026-07-01",
  updatedAt: "",
  fieldUpdatedAt: {},
  ...over,
});

const meta = (over: Partial<MindMetaRecord> & { id: string }): MindMetaRecord => ({
  kind: "category",
  key: "",
  value: true,
  setAt: "",
  updatedAt: "",
  fieldUpdatedAt: {},
  ...over,
});

const disableCategory = (key: string): MindMetaRecord =>
  meta({ id: metaId("category", key), kind: "category", key, value: false });

describe("buildAuthoredFeedCards", () => {
  it("excludes hidden cards", () => {
    const cards = [card({ id: "a" }), card({ id: "b", hiddenAt: "2026-07-02" })];
    expect(buildAuthoredFeedCards(cards, [], TODAY).map((c) => c.id)).toEqual(["a"]);
  });

  it("excludes cards in a disabled category", () => {
    const cards = [
      card({ id: "a", category: "Negotiation" }),
      card({ id: "b", category: "mental models" }),
    ];
    const ids = buildAuthoredFeedCards(cards, [disableCategory("negotiation")], TODAY).map(
      (c) => c.id,
    );
    expect(ids).toEqual(["b"]);
  });

  it("derives learning from box and due from nextDue <= today", () => {
    const cards = [
      card({ id: "regular" }),
      card({ id: "future", box: 2, nextDue: "2026-08-01" }),
      card({ id: "due", box: 3, nextDue: TODAY }),
      card({ id: "overdue", box: 1, nextDue: "2026-07-01" }),
    ];
    const built = buildAuthoredFeedCards(cards, [], TODAY);
    const byId = Object.fromEntries(built.map((c) => [c.id, c]));

    expect(byId.regular.learning).toBe(false);
    expect(byId.regular.box).toBe(null);
    expect(byId.regular.due).toBe(false);

    expect(byId.future.learning).toBe(true);
    expect(byId.future.box).toBe(2);
    expect(byId.future.due).toBe(false);

    expect(byId.due.due).toBe(true);
    expect(byId.overdue.due).toBe(true);
  });

  it("keeps an empty body as an empty string (no flip downstream)", () => {
    const built = buildAuthoredFeedCards([card({ id: "a", body: "" })], [], TODAY);
    expect(built[0].body).toBe("");
  });

  it("maps every field and leaves maskedBody null", () => {
    const built = buildAuthoredFeedCards(
      [card({ id: "a", title: "Inversion", body: "avoid", category: "Focus", source: "Munger" })],
      [],
      TODAY,
    );
    expect(built[0]).toEqual({
      id: "a",
      kind: "authored",
      category: "Focus",
      title: "Inversion",
      body: "avoid",
      source: "Munger",
      learning: false,
      box: null,
      due: false,
      maskedBody: null,
    });
  });
});

describe("buildVocabFeedCards", () => {
  it("returns nothing when the vocab source toggle is off", () => {
    const disabled = meta({
      id: metaId("source", "vocab"),
      kind: "source",
      key: "vocab",
      value: false,
    });
    expect(buildVocabFeedCards([entry({ id: "v1" })], [disabled], TODAY)).toEqual([]);
  });

  it("respects a per-entry hide meta", () => {
    const hide = meta({
      id: metaId("hide", "d:vocab:v1"),
      kind: "hide",
      key: "d:vocab:v1",
      value: true,
    });
    const vocab = [entry({ id: "v1" }), entry({ id: "v2" })];
    expect(buildVocabFeedCards(vocab, [hide], TODAY).map((c) => c.id)).toEqual(["d:vocab:v2"]);
  });

  it("shapes a vocab card with definition and example", () => {
    const built = buildVocabFeedCards(
      [entry({ id: "v1", term: "hola", definition: "hello", example: "hola amigo", box: 4 })],
      [],
      TODAY,
    );
    expect(built[0]).toEqual({
      id: "d:vocab:v1",
      kind: "vocab",
      category: "vocabulary",
      title: "hola",
      body: "**hello**\n\nhola amigo",
      source: null,
      learning: true,
      box: 4,
      due: false,
      maskedBody: null,
    });
  });

  it("omits the example paragraph when the example is empty", () => {
    const built = buildVocabFeedCards(
      [entry({ id: "v1", definition: "hello", example: "" })],
      [],
      TODAY,
    );
    expect(built[0].body).toBe("**hello**");
  });

  it("derives due from the entry's own nextDue", () => {
    const vocab = [
      entry({ id: "due", nextDue: TODAY }),
      entry({ id: "overdue", nextDue: "2026-07-01" }),
      entry({ id: "future", nextDue: "2026-08-01" }),
      entry({ id: "unscheduled", nextDue: null }),
    ];
    const byId = Object.fromEntries(buildVocabFeedCards(vocab, [], TODAY).map((c) => [c.id, c]));
    expect(byId["d:vocab:due"].due).toBe(true);
    expect(byId["d:vocab:overdue"].due).toBe(true);
    expect(byId["d:vocab:future"].due).toBe(false);
    expect(byId["d:vocab:unscheduled"].due).toBe(false);
  });
});

describe("buildFeedPool", () => {
  it("concatenates authored then vocab in stable order", () => {
    const mindCards = [card({ id: "a" }), card({ id: "b" })];
    const vocab = [entry({ id: "v1" }), entry({ id: "v2" })];
    const pool = buildFeedPool({ mindCards, mindMeta: [], vocab }, TODAY);
    expect(pool.map((c) => c.id)).toEqual(["a", "b", "d:vocab:v1", "d:vocab:v2"]);
    expect(pool.map((c) => c.kind)).toEqual(["authored", "authored", "vocab", "vocab"]);
  });

  it("applies both sources' exclusion rules", () => {
    const mindCards = [
      card({ id: "a", category: "Focus" }),
      card({ id: "hidden", hiddenAt: "2026-07-02" }),
    ];
    const vocab = [entry({ id: "v1" })];
    const mindMeta = [
      meta({ id: metaId("source", "vocab"), kind: "source", key: "vocab", value: false }),
    ];
    const pool = buildFeedPool({ mindCards, mindMeta, vocab }, TODAY);
    expect(pool.map((c) => c.id)).toEqual(["a"]);
  });
});
