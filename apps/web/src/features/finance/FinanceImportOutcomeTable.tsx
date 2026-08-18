import { cx } from "@/core/ui";
import {
  filterByImportLens,
  type ImportOutcome,
  type ImportOutcomeLens,
  type ImportPreviewRow,
  INTERNAL_REASON,
  NO_GUESS,
  OUTCOME_LABEL,
} from "./import-preview";
import { formatSignedCents } from "./ledger-copy";
import { CategoryChip } from "./primitives";

const GRID = "grid-cols-[5.5rem_1fr_11rem_6.5rem_7rem]";
const MIN_WIDTH = "min-w-[42rem]";
const HEADERS = ["Date", "Title from file", "Category guess", "Amount", "Outcome"];
const ROW_LIMIT = 8;

const OUTCOME_CLASS: Record<ImportOutcome, string> = {
  "will-add": "text-success",
  internal: "text-muted",
  "already-here": "text-muted",
};

export interface FinanceImportOutcomeTableProps {
  rows: ImportPreviewRow[];
  lenses: ImportOutcomeLens[];
  activeLens: ImportOutcome;
  onLensChange: (lens: ImportOutcome) => void;
}

function GuessCell({ row }: { row: ImportPreviewRow }) {
  if (row.outcome === "internal") {
    return <span className="text-[12.5px] text-muted">{INTERNAL_REASON}</span>;
  }
  if (row.guess === null) return <span className="text-[12.5px] text-muted">{NO_GUESS}</span>;
  if (row.outcome === "already-here") {
    return <span className="text-[12.5px] text-muted">{row.guess.name}</span>;
  }
  return <CategoryChip label={row.guess.name} color={row.guess.color} />;
}

function OutcomeRow({ row, isLast }: { row: ImportPreviewRow; isLast: boolean }) {
  const isPast = row.outcome === "already-here";
  return (
    <div
      className={cx(
        "grid h-11 items-center px-4",
        GRID,
        MIN_WIDTH,
        !isLast && "border-b border-border",
      )}
    >
      <span className="text-[13px] text-muted tabular-nums">{row.dateLabel}</span>
      <span
        className={cx(
          "truncate pr-3 text-[14px]",
          isPast ? "font-normal text-muted line-through" : "font-medium text-foreground",
        )}
      >
        {row.title}
      </span>
      <span className="flex min-w-0 items-center">
        <GuessCell row={row} />
      </span>
      <span
        className={cx(
          "text-right text-[13.5px] tabular-nums",
          row.outcome === "will-add" ? "font-medium text-foreground" : "text-muted",
        )}
      >
        {formatSignedCents(row.amountCents)}
      </span>
      <span className={cx("text-right font-medium text-[12.5px]", OUTCOME_CLASS[row.outcome])}>
        {OUTCOME_LABEL[row.outcome]}
      </span>
    </div>
  );
}

/** Every row a commit would touch and what it would do to it, before it does any of it. */
export function FinanceImportOutcomeTable({
  rows,
  lenses,
  activeLens,
  onLensChange,
}: FinanceImportOutcomeTableProps) {
  const lensed = filterByImportLens(rows, activeLens);
  const shown = lensed.slice(0, ROW_LIMIT);
  const overflow = lensed.length - shown.length;

  return (
    <section className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
        <h2 className="font-semibold text-[15px] text-foreground">What will happen</h2>
        <fieldset className="flex flex-wrap gap-2" aria-label="Filter the preview by outcome">
          {lenses.map((lens) => (
            <button
              type="button"
              key={lens.outcome}
              data-testid={`import-count-${lens.outcome}`}
              aria-pressed={lens.outcome === activeLens}
              onClick={() => onLensChange(lens.outcome)}
              className={cx(
                "inline-flex h-7 items-center gap-1.5 rounded-[10px] border px-3 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-accent",
                lens.outcome === activeLens
                  ? "border-accent font-medium text-foreground"
                  : "border-border text-muted hover:border-muted",
              )}
            >
              {lens.label}
              <span className="tabular-nums">{lens.count}</span>
            </button>
          ))}
        </fieldset>
      </div>

      <div className="overflow-x-auto">
        <div
          className={cx(
            "grid h-9 items-center border-t border-b border-border bg-surface-secondary px-4 text-[12px] text-muted",
            GRID,
            MIN_WIDTH,
          )}
        >
          {HEADERS.map((header) => (
            <span
              key={header}
              className={header === "Amount" || header === "Outcome" ? "text-right" : undefined}
            >
              {header}
            </span>
          ))}
        </div>

        {shown.map((row, index) => (
          <OutcomeRow key={row.key} row={row} isLast={index === shown.length - 1} />
        ))}

        {shown.length === 0 && (
          <div
            className={cx("grid h-11 place-items-center px-4 text-[12.5px] text-muted", MIN_WIDTH)}
          >
            No rows read this way.
          </div>
        )}
      </div>

      {overflow > 0 && (
        <div className="grid h-9 place-items-center bg-canvas font-medium text-[12.5px] text-muted">
          {overflow} more {overflow === 1 ? "row" : "rows"}
        </div>
      )}
    </section>
  );
}
