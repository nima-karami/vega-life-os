import {
  CARD_TYPE_IDS,
  CARD_TYPES,
  type CardTypeId,
  listTypeSlots,
  type SlotDef,
  type SlotId,
} from "@vega/shared";

export type SlotControl = "text" | "mono" | "textarea" | "rows" | "chips";

// A chip holds a word, a repeatable row holds a sentence — the per-item cap is what separates them.
const CHIP_MAX_CHARS = 80;

export function resolveSlotControl(def: SlotDef): SlotControl {
  if (def.maxItems !== undefined) return def.max <= CHIP_MAX_CHARS ? "chips" : "rows";
  if (def.lines === "tall") return "textarea";
  return def.mono === true ? "mono" : "text";
}

export interface CardPageField {
  slot: SlotId;
  def: SlotDef;
  control: SlotControl;
}

export function listCardPageFields(type: CardTypeId): CardPageField[] {
  return listTypeSlots(type).map(([slot, def]) => ({
    slot,
    def,
    control: resolveSlotControl(def),
  }));
}

export function listTypeOptions(): { id: CardTypeId; label: string }[] {
  return CARD_TYPE_IDS.map((id) => ({ id, label: CARD_TYPES[id].label }));
}

/** An empty form should show what a good card looks like, not six blank boxes. */
const SLOT_EXAMPLE: Partial<Record<SlotId, string>> = {
  title: "Second-order thinking",
  body: "And then what? First-order effects are obvious; the cost sits further out.",
  author: "Seneca",
  work: "Letters to Lucilius",
  locator: "p. 92",
  phonetic: "/saʊˈdɑdə/",
  language: "Portuguese",
  examples: "A quiet saudade for the city she left behind.",
  synonyms: "longing",
};

export function slotPlaceholder(def: SlotDef, slot?: SlotId): string {
  const example = slot === undefined ? undefined : SLOT_EXAMPLE[slot];
  if (example !== undefined) return example;
  return def.required === true ? "" : "Optional";
}
