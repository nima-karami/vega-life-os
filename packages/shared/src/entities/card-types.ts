export type SlotId =
  | "title"
  | "body"
  | "author"
  | "work"
  | "locator"
  | "phonetic"
  | "language"
  | "examples"
  | "synonyms";

export type SignatureId =
  | "term-gloss"
  | "title-body"
  | "body-author"
  | "body-source"
  | "body-alone";

export type SlotDef = {
  label: string;
  required?: true;
  lines?: "tall";
  mono?: true;
  /** max characters, or max characters per item for an array slot */
  max: number;
  maxItems?: number;
};

export type CardTypeDef = {
  label: string;
  /** also picks the fold: card-rules' FOLDING_SIGNATURES makes title-body and term-gloss two-sided */
  signature: SignatureId;
  /** absent means learnable once the card has a reveal */
  learnable?: false;
  /** declaration order IS field order */
  slots: Partial<Record<SlotId, SlotDef>>;
};

export const CARD_TYPE_IDS = ["note", "quote", "excerpt", "fact", "prompt", "vocabulary"] as const;

export type CardTypeId = (typeof CARD_TYPE_IDS)[number];

const title: SlotDef = { label: "Title", required: true, max: 160 };

export const CARD_TYPES: Record<CardTypeId, CardTypeDef> = {
  note: {
    label: "Note",
    signature: "title-body",
    slots: {
      title,
      body: { label: "Body", required: true, lines: "tall", max: 600 },
    },
  },
  quote: {
    label: "Quote",
    signature: "body-author",
    slots: {
      title,
      body: { label: "Quote", required: true, lines: "tall", max: 600 },
      author: { label: "Attribution", max: 120 },
      work: { label: "Source", max: 160 },
    },
  },
  excerpt: {
    label: "Excerpt",
    signature: "body-source",
    slots: {
      title,
      body: { label: "Excerpt", required: true, lines: "tall", max: 600 },
      work: { label: "Source", max: 160 },
      locator: { label: "Page", max: 40 },
    },
  },
  fact: {
    label: "Fact",
    signature: "body-alone",
    slots: {
      title,
      body: { label: "Fact", required: true, lines: "tall", max: 600 },
      work: { label: "Source", max: 160 },
    },
  },
  prompt: {
    label: "Prompt",
    signature: "body-alone",
    learnable: false,
    slots: {
      title,
      body: { label: "Prompt", required: true, lines: "tall", max: 600 },
    },
  },
  vocabulary: {
    label: "Vocabulary",
    signature: "term-gloss",
    slots: {
      title: { label: "Word", required: true, max: 160 },
      phonetic: { label: "Pronunciation", mono: true, max: 60 },
      language: { label: "Language", max: 40 },
      body: { label: "Definition", required: true, lines: "tall", max: 600 },
      examples: { label: "Examples", max: 200, maxItems: 5 },
      synonyms: { label: "Synonyms", max: 60, maxItems: 12 },
    },
  },
};

export function listTypeSlots(type: CardTypeId): Array<[SlotId, SlotDef]> {
  return Object.entries(CARD_TYPES[type].slots) as Array<[SlotId, SlotDef]>;
}
