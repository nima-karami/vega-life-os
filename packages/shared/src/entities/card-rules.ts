import type { Card } from "./card";
import { CARD_TYPES, type SignatureId } from "./card-types";

export const FOLDING_SIGNATURES: readonly SignatureId[] = [
  "term-gloss",
  "title-body",
  "body-source",
];

export function isSignatureFolding(signature: SignatureId): boolean {
  return FOLDING_SIGNATURES.includes(signature);
}

export function signatureOf(card: Pick<Card, "type">): SignatureId {
  return CARD_TYPES[card.type].signature;
}

export function foldsByDefault(card: Pick<Card, "type">): boolean {
  return isSignatureFolding(signatureOf(card));
}

export function hasReveal(card: Pick<Card, "type" | "hasRecall">): boolean {
  return foldsByDefault(card) || card.hasRecall;
}

export function isLearnable(card: Pick<Card, "type" | "hasRecall">): boolean {
  return CARD_TYPES[card.type].learnable !== false && hasReveal(card);
}

export function canPromote(card: Pick<Card, "type" | "hasRecall" | "title">): boolean {
  return (
    CARD_TYPES[card.type].learnable !== false &&
    !foldsByDefault(card) &&
    !card.hasRecall &&
    card.title.trim() !== ""
  );
}

// Total by construction: a type that can never be learned has no second step, whatever a
// stray hasRecall says. The schema forbids that state; this does not depend on it holding.
export function feedStep(
  card: Pick<Card, "type" | "hasRecall" | "box">,
): "open" | "folded" | "graded" {
  if (!isLearnable(card)) return "open";
  return card.box === null ? "folded" : "graded";
}
