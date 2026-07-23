export type { MindCard, MindCardType, MindMetaRecord } from "@vega/shared";

import type { MindCardType, MindMetaRecord } from "@vega/shared";

const VOCAB_ID_PREFIX = "d:vocab:";
const DERIVED_ID_PREFIX = "d:";

const FLIPPABLE_BY_DEFAULT: readonly MindCardType[] = ["model", "fact"];

export const isFlippableByDefault = (type: MindCardType): boolean =>
  FLIPPABLE_BY_DEFAULT.includes(type);

export const MIND_CARD_TYPE_LABELS: Record<MindCardType, string> = {
  model: "Model",
  fact: "Fact",
  excerpt: "Excerpt",
  quote: "Quote",
  principle: "Principle",
  affirmation: "Affirmation",
  reminder: "Reminder",
  aspiration: "Aspiration",
  prompt: "Prompt",
};

export const normalizeCategory = (raw: string): string => raw.trim();

export const matchKey = (raw: string): string => raw.trim().toLowerCase();

export const buildMetaId = (kind: MindMetaRecord["kind"], key: string): string =>
  `${kind}:${matchKey(key)}`;

export const isSameCategory = (a: string, b: string): boolean => matchKey(a) === matchKey(b);

export const buildVocabCardId = (id: string): string => `${VOCAB_ID_PREFIX}${id}`;

export const parseVocabCardId = (cardId: string): string => cardId.slice(VOCAB_ID_PREFIX.length);

export const isDerivedId = (cardId: string): boolean => cardId.startsWith(DERIVED_ID_PREFIX);
