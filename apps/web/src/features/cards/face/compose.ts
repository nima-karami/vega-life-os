import { CARD_TYPES, type Card, hasReveal, type SignatureId, signatureOf } from "@vega/shared";

export type FaceSide = "face" | "reveal";

export type FaceBlock =
  | { kind: "term"; text: string }
  | { kind: "title"; text: string }
  | { kind: "lead"; text: string }
  | { kind: "body"; text: string }
  | { kind: "mono"; text: string }
  | { kind: "caps"; text: string }
  | { kind: "quoteMark" }
  | { kind: "rule" };

export type FaceSpec = {
  signature: SignatureId;
  side: FaceSide;
  typeLabel: string;
  category: string;
  blocks: FaceBlock[];
};

const SENTENCE_BOUNDARY = /[.!?]["')\]]?(?=\s|$)/;
const PARAGRAPH_BREAK = "\n\n";

export function splitLead(body: string): { lead: string; remainder: string } {
  const text = body.trim();
  if (text === "") return { lead: "", remainder: "" };

  const sentence = SENTENCE_BOUNDARY.exec(text);
  const sentenceEnd = sentence === null ? -1 : sentence.index + sentence[0].length;
  const paragraphEnd = text.indexOf(PARAGRAPH_BREAK);
  const boundary =
    paragraphEnd >= 0 && (sentenceEnd < 0 || paragraphEnd < sentenceEnd)
      ? paragraphEnd
      : sentenceEnd;

  if (boundary < 0 || boundary >= text.length) return { lead: text, remainder: "" };
  return { lead: text.slice(0, boundary).trim(), remainder: text.slice(boundary).trim() };
}

const joinCaps = (parts: (string | null)[]): string =>
  parts
    .map((part) => (part ?? "").trim())
    .filter((part) => part !== "")
    .join(" · ");

function composeTermGlossFace(card: Card): FaceBlock[] {
  const term: FaceBlock = { kind: "term", text: card.title.trim() };
  const phonetic = (card.phonetic ?? "").trim();
  if (phonetic === "") return [term];
  return [term, { kind: "rule" }, { kind: "mono", text: phonetic }];
}

function composeTermGlossReveal(card: Card): FaceBlock[] {
  const blocks: FaceBlock[] = [
    { kind: "caps", text: card.title.trim() },
    { kind: "lead", text: card.body.trim() },
  ];
  const example = (card.examples[0] ?? "").trim();
  if (example !== "") blocks.push({ kind: "rule" }, { kind: "body", text: example });
  const synonyms = joinCaps(card.synonyms);
  if (synonyms !== "") blocks.push({ kind: "caps", text: synonyms });
  return blocks;
}

function composeTitleBodyFace(card: Card): FaceBlock[] {
  const title: FaceBlock = { kind: "title", text: card.title.trim() };
  const body = card.body.trim();
  if (hasReveal(card) || body === "") return [title];
  return [title, { kind: "rule" }, { kind: "body", text: body }];
}

function composeTitleBodyReveal(card: Card): FaceBlock[] {
  const { lead, remainder } = splitLead(card.body);
  const blocks: FaceBlock[] = [
    { kind: "caps", text: card.title.trim() },
    { kind: "lead", text: lead },
  ];
  if (remainder !== "") blocks.push({ kind: "rule" }, { kind: "body", text: remainder });
  return blocks;
}

function composeSignatureFace(card: Card, signature: SignatureId): FaceBlock[] {
  if (signature === "term-gloss") return composeTermGlossFace(card);
  return composeTitleBodyFace(card);
}

function composeSignatureReveal(card: Card, signature: SignatureId): FaceBlock[] {
  if (signature === "term-gloss") return composeTermGlossReveal(card);
  if (signature === "title-body") return composeTitleBodyReveal(card);
  return composeSignatureFace(card, signature);
}

export function composeFace(card: Card, side: FaceSide): FaceSpec {
  const signature = signatureOf(card);
  const typeLabel = CARD_TYPES[card.type].label;
  const category = card.category.trim();

  if (side === "face" && card.hasRecall) {
    return {
      signature: "title-body",
      side,
      typeLabel,
      category,
      blocks: [{ kind: "title", text: card.title.trim() }],
    };
  }

  const showsReveal = side === "reveal" && !card.hasRecall;
  const blocks = showsReveal
    ? composeSignatureReveal(card, signature)
    : composeSignatureFace(card, signature);
  return { signature, side, typeLabel, category, blocks };
}
