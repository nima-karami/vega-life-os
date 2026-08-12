import type { MindCard, MindMetaRecord } from "@vega/shared";
import { listVocabExamples, type VocabEntry } from "@/features/library/model";
import { buildMetaId, buildVocabCardId, type MindCardType } from "./model";
import { isScrollKeyEnabled } from "./store";

export type FeedCard = {
  id: string;
  kind: "authored" | "vocab" | "recap";
  type: MindCardType | null;
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
  flippable: boolean;
  liked: boolean;
};

export const resolveBodyVariant = (card: FeedCard, variant: number): string => {
  if (card.bodyVariants === null || card.bodyVariants.length === 0) return card.body;
  return card.bodyVariants[variant % card.bodyVariants.length];
};

const isDue = (nextDue: string | null, today: string): boolean =>
  nextDue !== null && nextDue <= today;

const buildVocabDefinition = (definition: string): string => `**${definition}**`;

const buildVocabBack = (definition: string, example: string, synonyms: string[]): string => {
  const parts = [buildVocabDefinition(definition)];
  if (example) parts.push(example);
  if (synonyms.length > 0) parts.push(`_Synonyms: ${synonyms.join(", ")}_`);
  return parts.join("\n\n");
};

const buildVocabBackVariants = (entry: VocabEntry): string[] => {
  const examples = listVocabExamples(entry);
  const synonyms = entry.synonyms ?? [];
  return (examples.length > 0 ? examples : [""]).map((example) =>
    buildVocabBack(entry.definition, example, synonyms),
  );
};

type AuthoredFields = Pick<
  FeedCard,
  "id" | "type" | "category" | "title" | "body" | "source" | "flippable" | "learning" | "box"
> & { due: boolean; liked: boolean };

const buildAuthoredCard = (fields: AuthoredFields): FeedCard => ({
  ...fields,
  kind: "authored",
  subtitle: null,
  bodyVariants: null,
  maskedBody: null,
});

export const toAuthoredFeedCard = (card: MindCard, today: string): FeedCard =>
  buildAuthoredCard({
    id: card.id,
    type: card.type,
    category: card.category,
    title: card.title,
    body: card.body,
    source: card.source,
    flippable: card.flippable,
    learning: card.box !== null,
    box: card.box,
    due: isDue(card.nextDue, today),
    liked: card.likedAt !== null,
  });

/** An unsaved editor draft rendered as the feed would render it. */
export const buildDraftFeedCard = (draft: {
  type: MindCardType;
  title: string;
  body: string;
  category: string;
  source: string;
  flippable: boolean;
  learning: boolean;
}): FeedCard =>
  buildAuthoredCard({
    id: "draft",
    type: draft.type,
    category: draft.category.trim(),
    title: draft.title.trim(),
    body: draft.body,
    source: draft.source.trim() || null,
    flippable: draft.flippable,
    learning: draft.learning,
    box: null,
    due: false,
    liked: false,
  });

export function buildAuthoredFeedCards(
  cards: MindCard[],
  meta: MindMetaRecord[],
  today: string,
): FeedCard[] {
  const disabledCategoryIds = new Set(
    meta.filter((m) => m.kind === "category" && m.value === false).map((m) => m.id),
  );
  return cards
    .filter(
      (c) => c.hiddenAt === null && !disabledCategoryIds.has(buildMetaId("category", c.category)),
    )
    .map((c) => toAuthoredFeedCard(c, today));
}

export function buildVocabFeedCards(
  vocab: VocabEntry[],
  meta: MindMetaRecord[],
  today: string,
): FeedCard[] {
  if (!isScrollKeyEnabled(meta, "source", "vocab")) return [];
  const hiddenDerivedIds = new Set(
    meta.filter((m) => m.kind === "hide" && m.value === true).map((m) => m.id),
  );
  const likedDerivedIds = new Set(
    meta.filter((m) => m.kind === "like" && m.value === true).map((m) => m.id),
  );
  return vocab
    .filter((entry) => !hiddenDerivedIds.has(buildMetaId("hide", buildVocabCardId(entry.id))))
    .map((entry) => {
      const bodyVariants = buildVocabBackVariants(entry);
      return {
        id: buildVocabCardId(entry.id),
        kind: "vocab" as const,
        type: null,
        category: "vocabulary",
        title: entry.term,
        subtitle: entry.phonetic || null,
        body: bodyVariants[0],
        bodyVariants,
        source: null,
        learning: true,
        box: entry.box,
        due: isDue(entry.nextDue, today),
        maskedBody: buildVocabDefinition(entry.definition),
        flippable: true,
        liked: likedDerivedIds.has(buildMetaId("like", buildVocabCardId(entry.id))),
      };
    });
}

export function buildFeedPool(
  state: { mindCards: MindCard[]; mindMeta: MindMetaRecord[]; vocab: VocabEntry[] },
  today: string,
): FeedCard[] {
  return [
    ...buildAuthoredFeedCards(state.mindCards, state.mindMeta, today),
    ...buildVocabFeedCards(state.vocab, state.mindMeta, today),
  ];
}
