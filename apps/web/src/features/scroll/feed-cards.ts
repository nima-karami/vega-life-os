import type { MindCard, MindMetaRecord } from "@vega/shared";
import { listVocabExamples, type VocabEntry } from "@/features/library/model";
import { buildMetaId, buildVocabCardId } from "./model";
import { isScrollKeyEnabled } from "./store";

export type FeedCard = {
  id: string;
  kind: "authored" | "vocab" | "recap";
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
    .map((c) => ({
      id: c.id,
      kind: "authored",
      category: c.category,
      title: c.title,
      subtitle: null,
      body: c.body,
      bodyVariants: null,
      source: c.source,
      learning: c.box !== null,
      box: c.box,
      due: isDue(c.nextDue, today),
      maskedBody: null,
      flippable: c.flippable,
      liked: c.likedAt !== null,
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
