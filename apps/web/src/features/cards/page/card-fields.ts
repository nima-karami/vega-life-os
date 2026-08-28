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

export function slotPlaceholder(def: SlotDef): string {
  return typeof def.example === "string" ? def.example : (def.example[0] ?? "");
}
