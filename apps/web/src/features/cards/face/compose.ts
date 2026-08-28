import {
  CARD_TYPES,
  type Card,
  hasReveal,
  type SignatureId,
  type SlotId,
  signatureOf,
} from "@vega/shared";

export type FaceSide = "face" | "reveal";

export type FaceBlock = (
  | { kind: "term"; text: string }
  | { kind: "title"; text: string }
  | { kind: "lead"; text: string }
  | { kind: "body"; text: string }
  | { kind: "mono"; text: string }
  | { kind: "caps"; text: string }
  | { kind: "quoteMark" }
  | { kind: "rule" }
) & { isSample?: true };

export type FaceSpec = {
  signature: SignatureId;
  side: FaceSide;
  typeLabel: string;
  category: string;
  blocks: FaceBlock[];
};

type SampleTag = (...slots: SlotId[]) => { isSample?: true };

type CitationSlot = Extract<SlotId, "work" | "locator">;

const NO_SAMPLE: SampleTag = () => ({});

const buildSampleTag =
  (sampleSlots: ReadonlySet<SlotId>): SampleTag =>
  (...slots) =>
    slots.length > 0 && slots.every((slot) => sampleSlots.has(slot)) ? { isSample: true } : {};

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

const contributingCitationSlots = (card: Card, slots: CitationSlot[]): CitationSlot[] =>
  slots.filter((slot) => (card[slot] ?? "").trim() !== "");

function composeTermGlossFace(card: Card, tag: SampleTag): FaceBlock[] {
  const term: FaceBlock = { kind: "term", text: card.title.trim(), ...tag("title") };
  const phonetic = (card.phonetic ?? "").trim();
  if (phonetic === "") return [term];
  return [term, { kind: "rule" }, { kind: "mono", text: phonetic, ...tag("phonetic") }];
}

function composeTermGlossReveal(card: Card, tag: SampleTag): FaceBlock[] {
  const blocks: FaceBlock[] = [
    { kind: "caps", text: card.title.trim(), ...tag("title") },
    { kind: "lead", text: card.body.trim(), ...tag("body") },
  ];
  const example = (card.examples[0] ?? "").trim();
  if (example !== "")
    blocks.push({ kind: "rule" }, { kind: "body", text: example, ...tag("examples") });
  const synonyms = joinCaps(card.synonyms);
  if (synonyms !== "") blocks.push({ kind: "caps", text: synonyms, ...tag("synonyms") });
  return blocks;
}

function composeTitleBodyFace(card: Card, tag: SampleTag): FaceBlock[] {
  const title: FaceBlock = { kind: "title", text: card.title.trim(), ...tag("title") };
  const body = card.body.trim();
  if (hasReveal(card) || body === "") return [title];
  return [title, { kind: "rule" }, { kind: "body", text: body, ...tag("body") }];
}

function composeTitleBodyReveal(card: Card, tag: SampleTag): FaceBlock[] {
  const { lead, remainder } = splitLead(card.body);
  const blocks: FaceBlock[] = [
    { kind: "caps", text: card.title.trim(), ...tag("title") },
    { kind: "lead", text: lead, ...tag("body") },
  ];
  if (remainder !== "")
    blocks.push({ kind: "rule" }, { kind: "body", text: remainder, ...tag("body") });
  return blocks;
}

function composeBodyAuthorFace(card: Card, tag: SampleTag): FaceBlock[] {
  const author = (card.author ?? "").trim();
  const work = (card.work ?? "").trim();
  const blocks: FaceBlock[] = [];
  if (author !== "") blocks.push({ kind: "quoteMark" });
  blocks.push(
    { kind: "lead", text: card.body.trim(), ...tag("body") },
    { kind: "rule" },
    { kind: "caps", text: author === "" ? "UNATTRIBUTED" : author, ...tag("author") },
  );
  if (work !== "") blocks.push({ kind: "body", text: work, ...tag("work") });
  return blocks;
}

function composeLeadAndCitation(
  body: string,
  citation: string,
  tag: SampleTag,
  citationSlots: CitationSlot[],
): FaceBlock[] {
  const { lead, remainder } = splitLead(body);
  const blocks: FaceBlock[] = [{ kind: "lead", text: lead, ...tag("body") }];
  if (remainder !== "") blocks.push({ kind: "body", text: remainder, ...tag("body") });
  if (citation !== "")
    blocks.push({ kind: "rule" }, { kind: "caps", text: citation, ...tag(...citationSlots) });
  return blocks;
}

function composeSignatureFace(card: Card, signature: SignatureId, tag: SampleTag): FaceBlock[] {
  switch (signature) {
    case "term-gloss":
      return composeTermGlossFace(card, tag);
    case "title-body":
      return composeTitleBodyFace(card, tag);
    case "body-author":
      return composeBodyAuthorFace(card, tag);
    case "body-source":
      return composeLeadAndCitation(
        card.body,
        joinCaps([card.work, card.locator]),
        tag,
        contributingCitationSlots(card, ["work", "locator"]),
      );
    case "body-alone":
      return composeLeadAndCitation(
        card.body,
        joinCaps([card.work]),
        tag,
        contributingCitationSlots(card, ["work"]),
      );
  }
}

function composeSignatureReveal(card: Card, signature: SignatureId, tag: SampleTag): FaceBlock[] {
  if (signature === "term-gloss") return composeTermGlossReveal(card, tag);
  if (signature === "title-body") return composeTitleBodyReveal(card, tag);
  return composeSignatureFace(card, signature, tag);
}

function ghostRulesWhenWhollySample(blocks: FaceBlock[]): FaceBlock[] {
  const texts = blocks.filter((block) => block.kind !== "rule" && block.kind !== "quoteMark");
  if (texts.length === 0 || !texts.every((block) => block.isSample === true)) return blocks;
  return blocks.map((block) => (block.kind === "rule" ? { ...block, isSample: true } : block));
}

export function composeFace(
  card: Card,
  side: FaceSide,
  sampleSlots?: ReadonlySet<SlotId>,
): FaceSpec {
  const signature = signatureOf(card);
  const typeLabel = CARD_TYPES[card.type].label;
  const category = card.category.trim();
  const tag = sampleSlots === undefined ? NO_SAMPLE : buildSampleTag(sampleSlots);

  if (side === "face" && card.hasRecall) {
    return {
      signature: "title-body",
      side,
      typeLabel,
      category,
      blocks: [{ kind: "title", text: card.title.trim(), ...tag("title") }],
    };
  }

  const showsReveal = side === "reveal" && !card.hasRecall;
  const blocks = showsReveal
    ? composeSignatureReveal(card, signature, tag)
    : composeSignatureFace(card, signature, tag);
  return { signature, side, typeLabel, category, blocks: ghostRulesWhenWhollySample(blocks) };
}
