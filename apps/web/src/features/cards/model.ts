import type { MindMetaRecord } from "@vega/shared";

export type { MindMetaRecord } from "@vega/shared";

const VOCAB_ID_PREFIX = "d:vocab:";

export const normalizeCategory = (raw: string): string => raw.trim();

export const matchKey = (raw: string): string => raw.trim().toLowerCase();

export const isSameCategory = (a: string, b: string): boolean => matchKey(a) === matchKey(b);

/** Migration v4 only: the key shape the retired mindMeta rows were written with. */
export const buildMetaId = (kind: MindMetaRecord["kind"], key: string): string =>
  `${kind}:${matchKey(key)}`;

export const buildVocabCardId = (id: string): string => `${VOCAB_ID_PREFIX}${id}`;
