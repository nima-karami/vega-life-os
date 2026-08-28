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

export type SlotExample = string | readonly string[];

export type SlotDef = {
  label: string;
  required?: true;
  lines?: "tall";
  mono?: true;
  /** max characters, or max characters per item for an array slot */
  max: number;
  maxItems?: number;
  /** what the slot looks like filled in — the form placeholder and the ghosted preview */
  example: SlotExample;
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

const titleWith = (example: string): SlotDef => ({
  label: "Title",
  required: true,
  max: 160,
  example,
});

export const CARD_TYPES: Record<CardTypeId, CardTypeDef> = {
  note: {
    label: "Note",
    signature: "title-body",
    slots: {
      title: titleWith("Second-order thinking"),
      body: {
        label: "Body",
        required: true,
        lines: "tall",
        max: 600,
        example: "And then what? First-order effects are obvious; the cost sits further out.",
      },
    },
  },
  quote: {
    label: "Quote",
    signature: "body-author",
    slots: {
      title: titleWith("The mind is a fire"),
      body: {
        label: "Quote",
        required: true,
        lines: "tall",
        max: 600,
        example: "The mind is not a vessel to be filled, but a fire to be kindled.",
      },
      author: { label: "Attribution", max: 120, example: "Plutarch" },
      work: { label: "Source", max: 160, example: "On Listening" },
    },
  },
  excerpt: {
    label: "Excerpt",
    signature: "body-source",
    slots: {
      title: titleWith("Attention is the rarest generosity"),
      body: {
        label: "Excerpt",
        required: true,
        lines: "tall",
        max: 600,
        example:
          "Attention is the rarest and purest form of generosity. It costs the giver everything and the receiver nothing.",
      },
      work: { label: "Source", max: 160, example: "Gravity and Grace" },
      locator: { label: "Page", max: 40, example: "p. 92" },
    },
  },
  fact: {
    label: "Fact",
    signature: "body-alone",
    slots: {
      title: titleWith("Bees know faces"),
      body: {
        label: "Fact",
        required: true,
        lines: "tall",
        max: 600,
        example: "Honeybees can learn to recognise individual human faces.",
      },
      work: { label: "Source", max: 160, example: "Journal of Experimental Biology" },
    },
  },
  prompt: {
    label: "Prompt",
    signature: "body-alone",
    learnable: false,
    slots: {
      title: titleWith("The week ahead"),
      body: {
        label: "Prompt",
        required: true,
        lines: "tall",
        max: 600,
        example: "What would make this week feel worth it by Friday?",
      },
    },
  },
  vocabulary: {
    label: "Vocabulary",
    signature: "term-gloss",
    slots: {
      title: { label: "Word", required: true, max: 160, example: "saudade" },
      phonetic: { label: "Pronunciation", mono: true, max: 60, example: "/saʊˈdɑdə/" },
      language: { label: "Language", max: 40, example: "Portuguese" },
      body: {
        label: "Definition",
        required: true,
        lines: "tall",
        max: 600,
        example: "A deep, nostalgic longing for something absent.",
      },
      examples: {
        label: "Examples",
        max: 200,
        maxItems: 5,
        example: ["A quiet saudade for the city she left behind."],
      },
      synonyms: { label: "Synonyms", max: 60, maxItems: 12, example: ["longing", "nostalgia"] },
    },
  },
};

export function listTypeSlots(type: CardTypeId): Array<[SlotId, SlotDef]> {
  return Object.entries(CARD_TYPES[type].slots) as Array<[SlotId, SlotDef]>;
}
