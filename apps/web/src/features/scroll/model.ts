export type { MindCard, MindMetaRecord } from "@vega/shared";

import type { MindMetaRecord } from "@vega/shared";

const VOCAB_ID_PREFIX = "d:vocab:";
const DERIVED_ID_PREFIX = "d:";

export const normalizeCategory = (raw: string): string => raw.trim();

export const matchKey = (raw: string): string => raw.trim().toLowerCase();

export const buildMetaId = (kind: MindMetaRecord["kind"], key: string): string =>
  `${kind}:${matchKey(key)}`;

export const isSameCategory = (a: string, b: string): boolean => matchKey(a) === matchKey(b);

export const buildVocabCardId = (id: string): string => `${VOCAB_ID_PREFIX}${id}`;

export const parseVocabCardId = (cardId: string): string => cardId.slice(VOCAB_ID_PREFIX.length);

export const isDerivedId = (cardId: string): boolean => cardId.startsWith(DERIVED_ID_PREFIX);
