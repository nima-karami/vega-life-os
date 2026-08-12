import type { Card } from "@vega/shared";
import { toCardFromMindCard, toCardFromVocab } from "../card-migration";
import { buildVocab } from "./library";
import { buildMindCards } from "./mind-cards";

/** The sandbox seed in the migrated shape: the same mappers the migration uses, so a
 *  freshly seeded sandbox and a migrated account hold byte-identical rows. */
export function buildCards(ref: Date, weekStart: Date): Card[] {
  return [
    ...buildMindCards().map(toCardFromMindCard),
    ...buildVocab(ref, weekStart).map((entry) => toCardFromVocab(entry, [])),
  ];
}
