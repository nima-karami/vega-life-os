import {
  type Card,
  type CardPrefs,
  type CardTypeId,
  hasReveal,
  isCardCategoryIncluded,
  isCardTypeIncluded,
} from "@vega/shared";

export type FeedCard = {
  id: string;
  type: CardTypeId;
  category: string;
  title: string;
  subtitle: string | null;
  body: string;
  bodyVariants: string[] | null;
  source: string | null;
  learning: boolean;
  box: number | null;
  due: boolean;
  maskedBody: string | null;
  hasReveal: boolean;
  liked: boolean;
};

export const resolveBodyVariant = (card: FeedCard, variant: number): string => {
  if (card.bodyVariants === null || card.bodyVariants.length === 0) return card.body;
  return card.bodyVariants[variant % card.bodyVariants.length];
};

const isDue = (nextDue: string | null, today: string): boolean =>
  nextDue !== null && nextDue <= today;

const emphasise = (text: string): string => `**${text}**`;

/** One reveal per example, so a word comes back in a different sentence each pass. */
function buildVocabBacks(card: Card): string[] {
  const synonyms = card.synonyms.length > 0 ? `_Synonyms: ${card.synonyms.join(", ")}_` : "";
  const examples = card.examples.length > 0 ? card.examples : [""];
  return examples.map((example) =>
    [emphasise(card.body), example, synonyms].filter((part) => part !== "").join("\n\n"),
  );
}

export function toFeedCard(card: Card, today: string): FeedCard {
  const isVocabulary = card.type === "vocabulary";
  const bodyVariants = isVocabulary ? buildVocabBacks(card) : null;
  return {
    id: card.id,
    type: card.type,
    category: card.category,
    title: card.title,
    subtitle: card.phonetic,
    body: bodyVariants ? bodyVariants[0] : card.body,
    bodyVariants,
    source: card.author ?? card.work,
    learning: card.box !== null,
    box: card.box,
    due: isDue(card.nextDue, today),
    maskedBody: isVocabulary ? emphasise(card.body) : null,
    hasReveal: hasReveal(card),
    liked: card.likedAt !== null,
  };
}

/** Interim: keeps the existing feed running on `cards`. Slice 5's feed-pool.ts replaces it. */
export function buildLegacyFeedPool(
  state: { cards: Card[]; cardPrefs: CardPrefs },
  today: string,
): FeedCard[] {
  return state.cards
    .filter(
      (card) =>
        card.hiddenAt === null &&
        isCardTypeIncluded(state.cardPrefs, card.type) &&
        isCardCategoryIncluded(state.cardPrefs, card.category),
    )
    .map((card) => toFeedCard(card, today));
}
