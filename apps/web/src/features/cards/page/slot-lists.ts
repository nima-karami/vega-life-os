import type { SlotDef } from "@vega/shared";

const matchKey = (raw: string): string => raw.trim().toLowerCase();

export function toStoredList(rows: string[]): string[] {
  return rows.map((row) => row.trim()).filter((row) => row !== "");
}

export function canAddListItem(items: string[], def: SlotDef): boolean {
  return def.maxItems === undefined || items.length < def.maxItems;
}

export function addChipValue(chips: string[], raw: string, def: SlotDef): string[] {
  const value = raw.trim().slice(0, def.max);
  if (value === "") return chips;
  if (!canAddListItem(chips, def)) return chips;
  if (chips.some((chip) => matchKey(chip) === matchKey(value))) return chips;
  return [...chips, value];
}

export function removeChipAt(chips: string[], index: number): string[] {
  if (index < 0 || index >= chips.length) return chips;
  return chips.filter((_, i) => i !== index);
}
