import { Button } from "@heroui/react";
import type { FinanceImportBatch } from "@vega/shared";
import { Icon } from "@/core/ui";
import { FinanceWorkedExample } from "./FinanceWorkedExample";
import { formatDateLabel } from "./import/fields";
import type { ParsedStatement } from "./import/types";
import type { AccountMismatch } from "./import-staging";
import { formatCents } from "./money";

const ROW_LIMIT = 200;

const describePriorImport = (batch: FinanceImportBatch) => {
  const when = batch.committedAt ?? batch.startedAt;
  const on = when ? ` on ${formatDateLabel(when)}` : "";
  return `You already imported this exact file${on} — ${batch.rowsInserted} rows landed then.`;
};

const COUNT_LABELS: { key: keyof ParsedStatement["counts"]; label: string }[] = [
  { key: "newRows", label: "New" },
  { key: "duplicate", label: "Duplicate" },
  { key: "internal", label: "Internal" },
  { key: "unknownMerchant", label: "Unknown merchant" },
  { key: "nearDuplicate", label: "Near duplicate" },
];

export interface FinanceImportPreviewProps {
  statement: ParsedStatement;
  mismatch: AccountMismatch | null;
  /** an earlier batch with the same file hash — why nothing new is landing */
  priorImport: FinanceImportBatch | null;
  accountName: string;
  isConfirmed: boolean;
  onConfirmedChange: (isConfirmed: boolean) => void;
  isCommitting: boolean;
  onCommit: () => void;
  onCancel: () => void;
}

/** Everything a commit would do, before it does any of it — nothing here has been written. */
export function FinanceImportPreview({
  statement,
  mismatch,
  priorImport,
  accountName,
  isConfirmed,
  onConfirmedChange,
  isCommitting,
  onCommit,
  onCancel,
}: FinanceImportPreviewProps) {
  const { counts } = statement;

  return (
    <section className="mt-6 space-y-5">
      <div className="rounded-[16px] border border-border bg-surface px-4 py-3">
        <p className="text-sm text-foreground">
          {statement.file} → {accountName}
        </p>
        <p className="mt-1 text-xs text-muted">
          {counts.parsed} rows read. Nothing is written until you press Import.
        </p>
        {priorImport && (
          <p data-testid="import-prior-file" className="mt-1.5 text-xs text-warning">
            {describePriorImport(priorImport)}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {COUNT_LABELS.map(({ key, label }) => (
          <div key={key} className="rounded-[12px] border border-border px-3 py-2.5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd
              data-testid={`import-count-${key}`}
              className="text-xl font-semibold tabular-nums text-foreground"
            >
              {counts[key]}
            </dd>
          </div>
        ))}
      </dl>

      {mismatch && (
        <p className="flex items-start gap-2 rounded-[12px] border border-warning px-3 py-2.5 text-sm text-warning">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <span>
            {mismatch.unmatched} of {mismatch.parsed} rows are merchants this account has never
            seen. Check the file belongs to {accountName} — the duplicate check can’t catch a
            statement filed against the wrong account.
          </span>
        </p>
      )}

      <div className="space-y-3 rounded-[16px] border border-border bg-surface px-4 py-3">
        <FinanceWorkedExample example={statement.workedExample} />
        <Button
          size="sm"
          variant={isConfirmed ? "primary" : "outline"}
          aria-pressed={isConfirmed}
          onPress={() => onConfirmedChange(!isConfirmed)}
        >
          {isConfirmed ? "Confirmed" : "Yes, that’s how this file reads"}
        </Button>
      </div>

      <div className="max-h-96 overflow-auto rounded-[16px] border border-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-normal">Date</th>
              <th className="px-3 py-2 font-normal">Description</th>
              <th className="px-3 py-2 text-right font-normal">Amount</th>
              <th className="px-3 py-2 font-normal">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {statement.rows.slice(0, ROW_LIMIT).map((row) => (
              <tr
                key={row.dedupeKey}
                className={row.isDuplicate ? "text-muted" : "text-foreground"}
              >
                <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{row.txnDate}</td>
                <td className="max-w-md truncate px-3 py-1.5">{row.description}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                  {formatCents(row.amountCents)}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-xs text-muted">
                  {[row.isDuplicate ? "duplicate" : null, ...row.reviewFlags]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {statement.rows.length > ROW_LIMIT && (
          <p className="px-3 py-2 text-xs text-muted">
            Showing the first {ROW_LIMIT} of {statement.rows.length} rows.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onPress={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          isDisabled={!isConfirmed || isCommitting || counts.newRows === 0}
          onPress={onCommit}
        >
          {isCommitting ? "Importing…" : `Import ${counts.newRows} rows`}
        </Button>
      </div>
    </section>
  );
}
