import { cx } from "@/core/ui";
import { ImportGuessLabel, OUTCOME_CLASS } from "../ImportGuessLabel";
import { type ImportPreviewRow, OUTCOME_LABEL } from "../import-preview";
import { formatSignedCents } from "../ledger-copy";
import { CompactRow } from "./CompactRow";

const WILL_ADD_AMOUNT = "font-medium text-[13.5px] text-foreground tabular-nums";
const SETTLED_AMOUNT = "text-[13.5px] text-muted tabular-nums";

/** The import preview on a phone — read before committing, so every outcome stays on screen. */
export function CompactImportOutcomes({ rows }: { rows: ImportPreviewRow[] }) {
  if (rows.length === 0)
    return (
      <p className="grid h-11 place-items-center px-4 text-[12.5px] text-muted">
        No rows read this way.
      </p>
    );

  return (
    <>
      {rows.map((row, index) => (
        <CompactRow
          key={row.key}
          title={
            <span
              className={
                row.outcome === "already-here" ? "font-normal text-muted line-through" : undefined
              }
            >
              {row.title}
            </span>
          }
          amount={formatSignedCents(row.amountCents)}
          amountClassName={row.outcome === "will-add" ? WILL_ADD_AMOUNT : SETTLED_AMOUNT}
          amountNote={
            <span className={cx("font-medium text-[12.5px]", OUTCOME_CLASS[row.outcome])}>
              {OUTCOME_LABEL[row.outcome]}
            </span>
          }
          meta={[{ value: row.dateLabel }, { value: <ImportGuessLabel row={row} /> }]}
          isLast={index === rows.length - 1}
        />
      ))}
    </>
  );
}
