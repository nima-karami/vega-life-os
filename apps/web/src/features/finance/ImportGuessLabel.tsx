import {
  type ImportOutcome,
  type ImportPreviewRow,
  INTERNAL_REASON,
  NO_GUESS,
} from "./import-preview";
import { CategoryChip } from "./primitives";

export const OUTCOME_CLASS: Record<ImportOutcome, string> = {
  "will-add": "text-success",
  internal: "text-muted",
  "already-here": "text-muted",
};

/** The merchant table's read on a staged row: a chip only where the row will actually land. */
export function ImportGuessLabel({ row }: { row: ImportPreviewRow }) {
  if (row.outcome === "internal") {
    return <span className="text-[12.5px] text-muted">{INTERNAL_REASON}</span>;
  }
  if (row.guess === null) return <span className="text-[12.5px] text-muted">{NO_GUESS}</span>;
  if (row.outcome === "already-here") {
    return <span className="text-[12.5px] text-muted">{row.guess.name}</span>;
  }
  return <CategoryChip label={row.guess.name} color={row.guess.color} />;
}
