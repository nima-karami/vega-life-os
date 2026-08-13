import { CARD_TYPE_IDS, type CardTypeId } from "@vega/shared";

const TITLE_MAX = 160;

export type DraftPrefill = { type: CardTypeId; title: string };

export function buildNewCardPath(type: CardTypeId, title: string): string {
  const params = new URLSearchParams({ type });
  const trimmed = title.trim();
  if (trimmed) params.set("title", trimmed.slice(0, TITLE_MAX));
  return `/cards/new?${params.toString()}`;
}

export function readDraftPrefill(search: string): DraftPrefill | null {
  const params = new URLSearchParams(search);
  const type = params.get("type");
  if (!type || !(CARD_TYPE_IDS as readonly string[]).includes(type)) return null;
  return {
    type: type as CardTypeId,
    title: (params.get("title") ?? "").trim().slice(0, TITLE_MAX),
  };
}
