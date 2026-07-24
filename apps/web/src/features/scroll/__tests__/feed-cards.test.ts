import type { MindCard, MindMetaRecord } from "@vega/shared";
import { describe, expect, it } from "vitest";
import type { VocabEntry } from "@/features/library/model";
import {
  buildAuthoredFeedCards,
  buildFeedPool,
  buildVocabFeedCards,
  resolveBodyVariant,
} from "../feed-cards";
import { buildMetaId, buildVocabCardId } from "../model";

const TODAY = "2026-07-22";

const card = (over: Partial<MindCard> = {}): MindCard => ({
  id: over.id ?? "mc_1",
  title: "",
  body: "",
  type: "note",
  origin: "manual",
  category: "",
  source: null,
  addedAt: "2026-07-01",
  hiddenAt: null,
  likedAt: null,
  flippable: true,
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
  phonetic: "",
  examples: [],
  synonyms: [],
  language: "es",
  box: 1,
  lastReviewed: null,
  nextDue: null,
  addedAt: "2026-07-01",
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
  meta({ id: buildMetaId("category", key), kind: "category", key, value: false });

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
      subtitle: null,
      body: "avoid",
      bodyVariants: null,
      source: "Munger",
      learning: false,
      box: null,
      due: false,
      maskedBody: null,
      flippable: true,
      liked: false,
    });
  });

  it("carries flippable and liked from the card record", () => {
    const cards = buildAuthoredFeedCards(
      [
        card({ id: "mc_a", flippable: false, type: "note" }),
        card({ id: "mc_b", likedAt: "2026-07-23T00:00:00.000Z" }),
      ],
      [],
      TODAY,
    );
    expect(cards[0]).toMatchObject({ flippable: false, liked: false });
    expect(cards[1]).toMatchObject({ flippable: true, liked: true });
  });
});

describe("buildVocabFeedCards", () => {
  it("returns nothing when the vocab source toggle is off", () => {
    const disabled = meta({
      id: buildMetaId("source", "vocab"),
      kind: "source",
      key: "vocab",
      value: false,
    });
    expect(buildVocabFeedCards([entry({ id: "v1" })], [disabled], TODAY)).toEqual([]);
  });

  it("respects a per-entry hide meta", () => {
    const hide = meta({
      id: buildMetaId("hide", "d:vocab:v1"),
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
      subtitle: null,
      body: "**hello**\n\nhola amigo",
      bodyVariants: ["**hello**\n\nhola amigo"],
      source: null,
      learning: true,
      box: 4,
      due: false,
      maskedBody: "**hello**",
      flippable: true,
      liked: false,
    });
  });

  it("is always flippable and reads liked from mindMeta", () => {
    const likeRecord = meta({
      id: buildMetaId("like", buildVocabCardId("v1")),
      kind: "like",
      key: buildVocabCardId("v1"),
      value: true,
    });
    const cards = buildVocabFeedCards([entry({ id: "v1" })], [likeRecord], TODAY);
    expect(cards[0]).toMatchObject({ flippable: true, liked: true });
  });

  it("omits the example paragraph when the example is empty", () => {
    const built = buildVocabFeedCards(
      [entry({ id: "v1", definition: "hello", example: "" })],
      [],
      TODAY,
    );
    expect(built[0].body).toBe("**hello**");
  });

  it("fills maskedBody with the definition only (example redacted)", () => {
    const withExample = buildVocabFeedCards(
      [entry({ id: "v1", definition: "hello", example: "hola amigo" })],
      [],
      TODAY,
    )[0];
    expect(withExample.maskedBody).toBe("**hello**");
    expect(withExample.maskedBody).not.toContain("hola amigo");

    const noExample = buildVocabFeedCards(
      [entry({ id: "v2", definition: "hello", example: "" })],
      [],
      TODAY,
    )[0];
    expect(noExample.maskedBody).toBe(noExample.body);
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

  it("composes one back variant per example with the synonyms line", () => {
    const built = buildVocabFeedCards(
      [
        entry({
          id: "v1",
          term: "digression",
          definition: "a turn away from the main subject",
          phonetic: "/daɪˈɡrɛʃ(ə)n/",
          examples: ["A digression in the data.", "A moral digression.", "One digression aside."],
          synonyms: ["tangent", "detour"],
          example: "",
        }),
      ],
      [],
      TODAY,
    );
    expect(built[0].subtitle).toBe("/daɪˈɡrɛʃ(ə)n/");
    expect(built[0].bodyVariants).toEqual([
      "**a turn away from the main subject**\n\nA digression in the data.\n\n_Synonyms: tangent, detour_",
      "**a turn away from the main subject**\n\nA moral digression.\n\n_Synonyms: tangent, detour_",
      "**a turn away from the main subject**\n\nOne digression aside.\n\n_Synonyms: tangent, detour_",
    ]);
    expect(built[0].body).toBe(built[0].bodyVariants?.[0]);
  });

  it("lifts a legacy single example into one variant", () => {
    const built = buildVocabFeedCards(
      [entry({ id: "v1", definition: "hello", example: "hola amigo", examples: [] })],
      [],
      TODAY,
    );
    expect(built[0].bodyVariants).toEqual(["**hello**\n\nhola amigo"]);
  });

  it("builds a single definition-only variant when there are no effective examples", () => {
    const built = buildVocabFeedCards(
      [entry({ id: "v1", definition: "hello", example: "", synonyms: ["hi"] })],
      [],
      TODAY,
    );
    expect(built[0].bodyVariants).toEqual(["**hello**\n\n_Synonyms: hi_"]);
    expect(built[0].subtitle).toBeNull();
  });

  it("keeps maskedBody free of phonetic, examples, and synonyms", () => {
    const built = buildVocabFeedCards(
      [
        entry({
          id: "v1",
          definition: "hello",
          phonetic: "/oʊˈlɑ/",
          examples: ["secret example"],
          synonyms: ["secret synonym"],
          example: "",
        }),
      ],
      [],
      TODAY,
    );
    expect(built[0].maskedBody).toBe("**hello**");
    expect(built[0].maskedBody).not.toContain("secret example");
    expect(built[0].maskedBody).not.toContain("secret synonym");
    expect(built[0].maskedBody).not.toContain("/oʊˈlɑ/");
  });
});

describe("resolveBodyVariant", () => {
  const vocabCard = buildVocabFeedCards(
    [
      entry({
        id: "v1",
        definition: "hello",
        examples: ["first", "second", "third"],
        example: "",
      }),
    ],
    [],
    TODAY,
  )[0];

  it("selects the stamped variant", () => {
    expect(resolveBodyVariant(vocabCard, 1)).toBe("**hello**\n\nsecond");
  });

  it("clamps an out-of-range variant via modulo", () => {
    expect(resolveBodyVariant(vocabCard, 7)).toBe(resolveBodyVariant(vocabCard, 1));
  });

  it("returns body for cards without variants", () => {
    const authored = buildAuthoredFeedCards([card({ id: "a", body: "note" })], [], TODAY)[0];
    expect(resolveBodyVariant(authored, 2)).toBe("note");
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
      meta({ id: buildMetaId("source", "vocab"), kind: "source", key: "vocab", value: false }),
    ];
    const pool = buildFeedPool({ mindCards, mindMeta, vocab }, TODAY);
    expect(pool.map((c) => c.id)).toEqual(["a"]);
  });
});
