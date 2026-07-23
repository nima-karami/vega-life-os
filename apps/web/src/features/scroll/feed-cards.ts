import type { MindCard, MindMetaRecord } from "@vega/shared";
import type { VocabEntry } from "@/features/library/model";
import { metaId, vocabCardId } from "./model";
import { isScrollKeyEnabled } from "./store";

export type FeedCard = {
  id: string;
  kind: "authored" | "vocab" | "recap";
  category: string;
  title: string;
  body: string;
  source: string | null;
  learning: boolean;
  box: number | null;
  due: boolean;
  maskedBody: string | null;
};

const isDue = (nextDue: string | null, today: string): boolean =>
  nextDue !== null && nextDue <= today;

const vocabDefinition = (definition: string): string => `**${definition}**`;

const vocabBody = (definition: string, example: string): string =>
  example ? `${vocabDefinition(definition)}\n\n${example}` : vocabDefinition(definition);

export function buildAuthoredFeedCards(
  cards: MindCard[],
  meta: MindMetaRecord[],
  today: string,
): FeedCard[] {
  const disabledCategoryIds = new Set(
    meta.filter((m) => m.kind === "category" && m.value === false).map((m) => m.id),
  );
  return cards
    .filter((c) => c.hiddenAt === null && !disabledCategoryIds.has(metaId("category", c.category)))
    .map((c) => ({
      id: c.id,
      kind: "authored",
      category: c.category,
      title: c.title,
      body: c.body,
      source: c.source,
      learning: c.box !== null,
      box: c.box,
      due: isDue(c.nextDue, today),
      maskedBody: null,
    }));
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
  return vocab
    .filter((entry) => !hiddenDerivedIds.has(metaId("hide", vocabCardId(entry.id))))
    .map((entry) => ({
      id: vocabCardId(entry.id),
      kind: "vocab",
      category: "vocabulary",
      title: entry.term,
      body: vocabBody(entry.definition, entry.example),
      source: null,
      learning: true,
      box: entry.box,
      due: isDue(entry.nextDue, today),
      maskedBody: vocabDefinition(entry.definition),
    }));
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
