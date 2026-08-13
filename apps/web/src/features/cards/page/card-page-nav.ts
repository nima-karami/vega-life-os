import type { Card, SlotId } from "@vega/shared";

/** Route state the manager and the feed use to hand this page an intent. */
export interface CardPageLocationState {
  focusSlot?: SlotId;
  cardUndo?: { message: string; card: Card };
}
