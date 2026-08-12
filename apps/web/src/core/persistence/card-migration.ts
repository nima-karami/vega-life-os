import {
  CARD_TYPE_IDS,
  CARD_TYPES,
  type Card,
  type CardPrefs,
  type CardTypeId,
  cardSchema,
  DEFAULT_CARD_PREFS,
  foldsByDefault,
  isLearnable,
  type MindCard,
  type MindMetaRecord,
} from "@vega/shared";
import { flattenMarkdown } from "@/core/lib/flatten-markdown";
import { buildMetaId, buildVocabCardId, matchKey } from "@/features/cards/model";
import { listCardCategories } from "@/features/cards/queries";
import { listVocabExamples, type VocabEntry } from "@/features/library/model";

export type SourceMeta = { updatedAt?: string; fieldUpdatedAt?: Record<string, string> };

const VOCAB_CATEGORY = "Language";
const TITLE_FALLBACK_MAX = 60;

const slotMax = (
  type: CardTypeId,
  slot: "title" | "body" | "phonetic" | "language" | "examples" | "synonyms",
): number => CARD_TYPES[type].slots[slot]?.max ?? 0;

const slotMaxItems = (type: CardTypeId, slot: "examples" | "synonyms"): number =>
  CARD_TYPES[type].slots[slot]?.maxItems ?? 0;

const cut = (value: string, max: number): string => value.slice(0, max);

const orNull = (value: string, max: number): string | null =>
  value.trim() === "" ? null : cut(value, max);

function deriveTitle(rawTitle: string, flatBody: string, max: number): string {
  const title = rawTitle.trim();
  if (title !== "") return cut(title, max);
  const excerpt = flatBody.replace(/\s+/g, " ").trim().slice(0, TITLE_FALLBACK_MAX).trim();
  return excerpt === "" ? "Untitled" : excerpt;
}

/** The schedule only survives onto a card the rules say can be learned. */
function withSchedule(
  card: Card,
  schedule: { box: number | null; lastReviewed: string | null; nextDue: string | null },
): Card {
  if (!isLearnable(card)) return { ...card, box: null, lastReviewed: null, nextDue: null };
  return { ...card, ...schedule };
}

export function toCardFromMindCard(source: MindCard): Card {
  const type = source.type as CardTypeId;
  const body = cut(flattenMarkdown(source.body), slotMax(type, "body"));
  const isQuote = type === "quote";
  const canCarryRecall = CARD_TYPES[type].learnable !== false && !foldsByDefault({ type });
  const card: Card = {
    id: source.id,
    type,
    category: source.category,
    title: deriveTitle(source.title, body, slotMax(type, "title")),
    body,
    author: isQuote ? source.source : null,
    work: isQuote ? null : source.source,
    locator: null,
    phonetic: null,
    language: null,
    examples: [],
    synonyms: [],
    hasRecall: canCarryRecall && source.flippable,
    addedAt: source.addedAt,
    hiddenAt: source.hiddenAt,
    likedAt: source.likedAt,
    box: null,
    lastReviewed: null,
    nextDue: null,
    reviewCount: 0,
    updatedAt: source.updatedAt,
    fieldUpdatedAt: source.fieldUpdatedAt,
  };
  return withSchedule(card, {
    box: source.box,
    lastReviewed: source.lastReviewed,
    nextDue: source.nextDue,
  });
}

function readDerivedFlag(
  meta: MindMetaRecord[],
  kind: "hide" | "like",
  entryId: string,
): string | null {
  const id = buildMetaId(kind, buildVocabCardId(entryId));
  const row = meta.find((m) => m.id === id);
  return row?.value === true ? row.setAt : null;
}

export function toCardFromVocab(entry: VocabEntry & SourceMeta, meta: MindMetaRecord[]): Card {
  const body = cut(flattenMarkdown(entry.definition), slotMax("vocabulary", "body"));
  const card: Card = {
    id: entry.id,
    type: "vocabulary",
    category: VOCAB_CATEGORY,
    title: deriveTitle(entry.term, body, slotMax("vocabulary", "title")),
    body,
    author: null,
    work: null,
    locator: null,
    phonetic: orNull(entry.phonetic ?? "", slotMax("vocabulary", "phonetic")),
    language: orNull(entry.language ?? "", slotMax("vocabulary", "language")),
    examples: listVocabExamples(entry)
      .slice(0, slotMaxItems("vocabulary", "examples"))
      .map((example) => cut(example, slotMax("vocabulary", "examples"))),
    synonyms: (entry.synonyms ?? [])
      .slice(0, slotMaxItems("vocabulary", "synonyms"))
      .map((synonym) => cut(synonym, slotMax("vocabulary", "synonyms"))),
    hasRecall: false,
    addedAt: entry.addedAt,
    hiddenAt: readDerivedFlag(meta, "hide", entry.id),
    likedAt: readDerivedFlag(meta, "like", entry.id),
    box: null,
    lastReviewed: null,
    nextDue: null,
    reviewCount: 0,
    updatedAt: entry.updatedAt ?? "",
    fieldUpdatedAt: entry.fieldUpdatedAt ?? {},
  };
  return withSchedule(card, {
    box: entry.box,
    lastReviewed: entry.lastReviewed,
    nextDue: entry.nextDue,
  });
}

/** meta rows record what is DISABLED; cardPrefs is an include list where empty means all. */
export function toCardPrefs(meta: MindMetaRecord[], categoriesInUse: string[]): CardPrefs {
  const disabled = new Set(
    meta.filter((m) => m.kind === "category" && m.value === false).map((m) => matchKey(m.key)),
  );
  const categories =
    disabled.size === 0 ? [] : categoriesInUse.filter((label) => !disabled.has(matchKey(label)));
  const isVocabOff = meta.some(
    (m) => m.kind === "source" && matchKey(m.key) === "vocab" && m.value === false,
  );
  return {
    ...DEFAULT_CARD_PREFS,
    types: isVocabOff ? CARD_TYPE_IDS.filter((id) => id !== "vocabulary") : [],
    categories,
  };
}

export type CardMigrationResult = {
  cards: Card[];
  prefs: CardPrefs;
  skipped: string[];
  endedSchedules: string[];
};

export function migrateToCards(sources: {
  mindCards: MindCard[];
  mindMeta: MindMetaRecord[];
  vocab: (VocabEntry & SourceMeta)[];
}): CardMigrationResult {
  const built = [
    ...sources.mindCards.map((source) => ({
      card: toCardFromMindCard(source),
      sourceBox: source.box,
    })),
    ...sources.vocab.map((entry) => ({
      card: toCardFromVocab(entry, sources.mindMeta),
      sourceBox: entry.box,
    })),
  ];
  const cards: Card[] = [];
  const skipped: string[] = [];
  const endedSchedules: string[] = [];
  for (const { card, sourceBox } of built) {
    if (!cardSchema.safeParse(card).success) {
      skipped.push(card.id);
      continue;
    }
    cards.push(card);
    // Real review state disappearing — a flippable prompt that was in learning. Never silent.
    if (sourceBox !== null && card.box === null) endedSchedules.push(card.id);
  }
  return {
    cards,
    prefs: toCardPrefs(sources.mindMeta, listCardCategories(cards)),
    skipped,
    endedSchedules,
  };
}
