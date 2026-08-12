import { z } from "zod";
import { defineEntity, nullableString } from "./base";
import { isSignatureFolding } from "./card-rules";
import { CARD_TYPE_IDS, CARD_TYPES, type CardTypeDef, type SlotId } from "./card-types";

const CATEGORY_MAX = 60;

const SLOT_IDS: readonly SlotId[] = [
  "title",
  "body",
  "author",
  "work",
  "locator",
  "phonetic",
  "language",
  "examples",
  "synonyms",
];

const cardBaseFields = {
  id: z.string(),
  category: z.string().max(CATEGORY_MAX),
  title: z.string(),
  body: z.string(),
  author: nullableString.default(null),
  work: nullableString.default(null),
  locator: nullableString.default(null),
  phonetic: nullableString.default(null),
  language: nullableString.default(null),
  examples: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
  hasRecall: z.boolean().default(false),
  addedAt: z.string(),
  hiddenAt: nullableString.default(null),
  likedAt: nullableString.default(null),
  box: z.number().nullable(),
  lastReviewed: nullableString,
  nextDue: nullableString,
  reviewCount: z.number().default(0),
};

type SlotValue = string | string[] | null;

/** The shape the rules read — every schema built by `buildCardSchema` produces it. */
export type RefinedCard = {
  type: string;
  title: string;
  body: string;
  author: string | null;
  work: string | null;
  locator: string | null;
  phonetic: string | null;
  language: string | null;
  examples: string[];
  synonyms: string[];
  hasRecall: boolean;
  box: number | null;
  lastReviewed: string | null;
  nextDue: string | null;
};

export type CardIssue = { path: string[]; message: string };

const readSlot = (card: RefinedCard, slot: SlotId): SlotValue => card[slot];

const isEmptySlot = (value: SlotValue): boolean =>
  value === null || value === "" || (Array.isArray(value) && value.length === 0);

function findSlotIssues(card: RefinedCard, def: CardTypeDef): CardIssue[] {
  const issues: CardIssue[] = [];
  for (const slot of SLOT_IDS) {
    const slotDef = def.slots[slot];
    const value = readSlot(card, slot);
    if (!slotDef) {
      if (!isEmptySlot(value))
        issues.push({ path: [slot], message: `a ${def.label} has no ${slot}` });
      continue;
    }
    if (Array.isArray(value)) {
      if (slotDef.maxItems !== undefined && value.length > slotDef.maxItems)
        issues.push({
          path: [slot],
          message: `${slotDef.label} holds at most ${slotDef.maxItems}`,
        });
      if (value.some((item) => item.length > slotDef.max))
        issues.push({
          path: [slot],
          message: `each ${slotDef.label} entry is at most ${slotDef.max} characters`,
        });
    } else {
      const text = value ?? "";
      if (slotDef.required === true && text.trim() === "")
        issues.push({ path: [slot], message: `${slotDef.label} is required` });
      if (text.length > slotDef.max)
        issues.push({
          path: [slot],
          message: `${slotDef.label} is at most ${slotDef.max} characters`,
        });
    }
    if (slotDef.required === true && Array.isArray(value) && value.length === 0)
      issues.push({ path: [slot], message: `${slotDef.label} is required` });
  }
  return issues;
}

export function findCardIssues(card: RefinedCard, types: Record<string, CardTypeDef>): CardIssue[] {
  const def = types[card.type];
  if (!def) return [];
  const issues = findSlotIssues(card, def);

  const learnable =
    def.learnable !== false && (isSignatureFolding(def.signature) || card.hasRecall);
  if (!learnable && (card.box !== null || card.nextDue !== null || card.lastReviewed !== null))
    issues.push({
      path: ["box"],
      message: `a ${def.label} that cannot be learned carries no schedule`,
    });
  if (card.box === null && (card.nextDue !== null || card.lastReviewed !== null))
    issues.push({ path: ["box"], message: "a card with no box carries no review dates" });

  if (card.hasRecall && def.learnable === false)
    issues.push({ path: ["hasRecall"], message: `a ${def.label} is never recalled` });
  if (card.hasRecall && card.title.trim() === "")
    issues.push({
      path: ["hasRecall"],
      message: "the title is what you recall, so it cannot be empty",
    });

  return issues;
}

export function buildCardSchema<Ids extends readonly string[]>(
  ids: Ids,
  types: Record<Ids[number], CardTypeDef>,
) {
  const registry = types as Record<string, CardTypeDef>;
  const { schema, createSchema } = defineEntity({ ...cardBaseFields, type: z.enum(ids) });
  const check = (
    card: RefinedCard,
    ctx: { addIssue: (issue: { code: "custom"; path: string[]; message: string }) => void },
  ) => {
    for (const issue of findCardIssues(card, registry))
      ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  };
  return {
    schema: schema.superRefine((card, ctx) => check(card, ctx)),
    createSchema: createSchema.superRefine((card, ctx) => check(card, ctx)),
  };
}

const cardSchemas = buildCardSchema(CARD_TYPE_IDS, CARD_TYPES);

export const cardSchema = cardSchemas.schema;
export const cardCreateSchema = cardSchemas.createSchema;
export type Card = z.infer<typeof cardSchema>;
/** What `addCard` takes: every stored field except the id the store mints and the server-owned meta. */
export type CardCreate = Omit<z.infer<typeof cardCreateSchema>, "id">;
