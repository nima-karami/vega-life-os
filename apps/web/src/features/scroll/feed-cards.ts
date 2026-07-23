import type { MindCard, MindMetaRecord } from "@vega/shared";
import type { VocabEntry } from "@/features/library/model";
import { metaId } from "./model";
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

const isVocabHidden = (meta: MindMetaRecord[], cardId: string): boolean =>
  meta.some((m) => m.id === metaId("hide", cardId) && m.value === true);

const vocabBody = (definition: string, example: string): string =>
  example ? `**${definition}**\n\n${example}` : `**${definition}**`;

export function buildAuthoredFeedCards(
  cards: MindCard[],
  meta: MindMetaRecord[],
  today: string,
): FeedCard[] {
  return cards
    .filter((c) => c.hiddenAt === null && isScrollKeyEnabled(meta, "category", c.category))
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
  return vocab
    .filter((entry) => !isVocabHidden(meta, `d:vocab:${entry.id}`))
    .map((entry) => ({
      id: `d:vocab:${entry.id}`,
      kind: "vocab",
      category: "vocabulary",
      title: entry.term,
      body: vocabBody(entry.definition, entry.example),
      source: null,
      learning: true,
      box: entry.box,
      due: isDue(entry.nextDue, today),
      maskedBody: null,
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
