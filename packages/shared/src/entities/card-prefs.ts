import { z } from "zod";
import { defineEntity } from "./base";
import { CARD_TYPE_IDS, type CardTypeId } from "./card-types";

const { schema, createSchema } = defineEntity({
  id: z.literal("feed"),
  mode: z.enum(["due", "mix", "read"]).default("mix"),
  types: z.array(z.enum(CARD_TYPE_IDS)).default([]),
  categories: z.array(z.string()).default([]),
  view: z.enum(["rows", "gallery"]).default("rows"),
  /** Set once, by migration v4. The synced guard that stops a second device re-running it. */
  migratedAt: z.string().nullable().default(null),
});

export const cardPrefsSchema = schema;
export const cardPrefsCreateSchema = createSchema;
export type CardPrefs = z.infer<typeof cardPrefsSchema>;

export const DEFAULT_CARD_PREFS: CardPrefs = {
  id: "feed",
  mode: "mix",
  types: [],
  categories: [],
  view: "rows",
  migratedAt: null,
  updatedAt: "",
  fieldUpdatedAt: {},
};

const key = (raw: string): string => raw.trim().toLowerCase();

export function isCardTypeIncluded(prefs: Pick<CardPrefs, "types">, type: CardTypeId): boolean {
  return prefs.types.length === 0 || prefs.types.includes(type);
}

export function isCardCategoryIncluded(
  prefs: Pick<CardPrefs, "categories">,
  category: string,
): boolean {
  return (
    prefs.categories.length === 0 || prefs.categories.some((label) => key(label) === key(category))
  );
}
