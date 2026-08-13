import {
  type Card,
  type CardPrefs,
  isCardCategoryIncluded,
  isCardTypeIncluded,
} from "@vega/shared";

export type FeedHeaderGlyph = "mode" | "filter";

const isDue = (card: Card, today: string): boolean =>
  card.box !== null && card.nextDue !== null && card.nextDue <= today;

function matchesMode(card: Card, mode: CardPrefs["mode"], today: string): boolean {
  if (mode === "due") return isDue(card, today);
  if (mode === "read") return card.box === null;
  return true;
}

// A stored category no card carries is ignored rather than enforced (spec §3.8): dropping it
// here leaves an empty list, which isCardCategoryIncluded already reads as "all".
function liveCategories(cards: Card[], selected: string[]): string[] {
  return selected.filter((label) =>
    cards.some((card) => isCardCategoryIncluded({ categories: [label] }, card.category)),
  );
}

export function buildFeedPool(cards: Card[], prefs: CardPrefs, today: string): Card[] {
  const categories = liveCategories(cards, prefs.categories);
  return cards.filter(
    (card) =>
      card.hiddenAt === null &&
      matchesMode(card, prefs.mode, today) &&
      isCardTypeIncluded(prefs, card.type) &&
      isCardCategoryIncluded({ categories }, card.category),
  );
}

export function countFeedDue(cards: Card[], prefs: CardPrefs, today: string): number {
  return buildFeedPool(cards, { ...prefs, mode: "due" }, today).length;
}

export function describeFeedGlyphs(cards: Card[], prefs: CardPrefs): FeedHeaderGlyph[] {
  const glyphs: FeedHeaderGlyph[] = [];
  if (prefs.mode !== "mix") glyphs.push("mode");
  const isNarrowed = prefs.types.length > 0 || liveCategories(cards, prefs.categories).length > 0;
  if (isNarrowed) glyphs.push("filter");
  return glyphs;
}
