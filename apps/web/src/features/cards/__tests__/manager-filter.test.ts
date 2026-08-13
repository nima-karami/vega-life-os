import { describe, expect, it } from "vitest";
import {
  type CardFilterState,
  countCheckedFilters,
  EMPTY_CARD_FILTER,
  matchesCardFilter,
  toCategoryKey,
  toggleFilterValue,
} from "../manager-filter";
import { buildCard } from "./fixtures";

const TODAY = "2026-08-11";
const filterWith = (over: Partial<CardFilterState>): CardFilterState => ({
  ...EMPTY_CARD_FILTER,
  ...over,
});

describe("countCheckedFilters", () => {
  it("counts checked values across every group, not rows", () => {
    expect(
      countCheckedFilters(
        filterWith({ types: ["vocabulary"], learning: ["learning"], categories: ["Language"] }),
      ),
    ).toBe(3);
  });

  it("counts the visibility row as one checked value", () => {
    expect(countCheckedFilters(filterWith({ hiddenOnly: true }))).toBe(1);
  });

  it("is zero for the empty filter", () => {
    expect(countCheckedFilters(EMPTY_CARD_FILTER)).toBe(0);
  });
});

describe("matchesCardFilter", () => {
  it("admits everything when no value is checked", () => {
    expect(matchesCardFilter(buildCard(), EMPTY_CARD_FILTER, TODAY)).toBe(true);
  });

  it("keeps hidden cards in the list while Show hidden is unchecked", () => {
    const hidden = buildCard({ hiddenAt: "2026-08-02T09:00:00.000Z" });
    expect(matchesCardFilter(hidden, EMPTY_CARD_FILTER, TODAY)).toBe(true);
  });

  it("narrows to hidden cards when Show hidden is checked", () => {
    const hidden = buildCard({ id: "h", hiddenAt: "2026-08-02T09:00:00.000Z" });
    const visible = buildCard({ id: "v" });
    const filter = filterWith({ hiddenOnly: true });
    expect(matchesCardFilter(hidden, filter, TODAY)).toBe(true);
    expect(matchesCardFilter(visible, filter, TODAY)).toBe(false);
  });

  it("ORs within the type group", () => {
    const filter = filterWith({ types: ["quote", "vocabulary"] });
    expect(matchesCardFilter(buildCard({ type: "quote" }), filter, TODAY)).toBe(true);
    expect(matchesCardFilter(buildCard({ type: "note" }), filter, TODAY)).toBe(false);
  });

  it("ANDs across groups", () => {
    const filter = filterWith({ types: ["vocabulary"], learning: ["learning"] });
    const learningVocab = buildCard({ type: "vocabulary", box: 3 });
    const readingVocab = buildCard({ type: "vocabulary", box: null });
    expect(matchesCardFilter(learningVocab, filter, TODAY)).toBe(true);
    expect(matchesCardFilter(readingVocab, filter, TODAY)).toBe(false);
  });

  it("treats Due today as due on or before today", () => {
    const filter = filterWith({ learning: ["due"] });
    expect(matchesCardFilter(buildCard({ box: 2, nextDue: "2026-08-09" }), filter, TODAY)).toBe(
      true,
    );
    expect(matchesCardFilter(buildCard({ box: 2, nextDue: "2026-08-12" }), filter, TODAY)).toBe(
      false,
    );
  });

  it("matches categories case-insensitively on the trimmed string", () => {
    const filter = filterWith({ categories: ["Mental models"] });
    expect(matchesCardFilter(buildCard({ category: " mental MODELS " }), filter, TODAY)).toBe(true);
  });
});

describe("toggleFilterValue", () => {
  it("adds a missing value and removes a present one", () => {
    expect(toggleFilterValue<string>([], "note")).toEqual(["note"]);
    expect(toggleFilterValue(["note", "quote"], "note")).toEqual(["quote"]);
  });
});

describe("toCategoryKey", () => {
  it("trims and lowercases", () => {
    expect(toCategoryKey("  Deep Work ")).toBe("deep work");
  });
});
