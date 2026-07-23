export type { MindCard, MindMetaRecord } from "@vega/shared";

import type { MindMetaRecord } from "@vega/shared";

export const normalizeCategory = (raw: string): string => raw.trim();

const matchKey = (raw: string): string => raw.trim().toLowerCase();

export const metaId = (kind: MindMetaRecord["kind"], key: string): string =>
  `${kind}:${matchKey(key)}`;

export const isSameCategory = (a: string, b: string): boolean => matchKey(a) === matchKey(b);
