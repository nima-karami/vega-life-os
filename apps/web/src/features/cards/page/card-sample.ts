import { type Card, listTypeSlots, type SlotDef, type SlotId } from "@vega/shared";

export interface SampledCard {
  card: Card;
  sampleSlots: ReadonlySet<SlotId>;
}

const isEmptySlot = (value: string | string[] | null): boolean =>
  value === null || (Array.isArray(value) ? value.length === 0 : value.trim() === "");

const toSlotValue = (def: SlotDef): string | string[] =>
  typeof def.example === "string" ? def.example : [...def.example];

/** Empty declared slots render as their registry example; nothing here is ever written. */
export function fillSampleSlots(card: Card): SampledCard {
  const filled: Card = { ...card };
  const sampleSlots = new Set<SlotId>();
  for (const [slot, def] of listTypeSlots(card.type)) {
    if (!isEmptySlot(card[slot])) continue;
    (filled as Record<string, unknown>)[slot] = toSlotValue(def);
    sampleSlots.add(slot);
  }
  return { card: filled, sampleSlots };
}
