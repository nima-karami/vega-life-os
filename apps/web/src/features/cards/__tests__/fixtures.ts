import type { Card, CardCreate } from "@vega/shared";

/** The one Card fixture the web tests build on — slices 2–5 import it rather than restating 25 fields. */
export function buildCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "c_1",
    type: "note",
    category: "mental models",
    title: "Inversion",
    body: "Solve it backward.",
    author: null,
    work: null,
    locator: null,
    phonetic: null,
    language: null,
    examples: [],
    synonyms: [],
    hasRecall: false,
    addedAt: "2026-07-01",
    hiddenAt: null,
    likedAt: null,
    box: null,
    lastReviewed: null,
    nextDue: null,
    reviewCount: 0,
    updatedAt: "",
    fieldUpdatedAt: {},
    ...overrides,
  };
}

export function buildCardCreate(overrides: Partial<CardCreate> = {}): CardCreate {
  const {
    id: _id,
    updatedAt: _updatedAt,
    fieldUpdatedAt: _fieldUpdatedAt,
    ...create
  } = buildCard();
  return { ...create, ...overrides };
}
