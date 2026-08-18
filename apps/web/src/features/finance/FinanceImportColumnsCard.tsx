import type { FinanceColumnMapping } from "@vega/shared";
import type { MappingWorkedExample } from "./import/types";
import { describeWorkedExample } from "./import-preview";
import { SelectField, type SelectFieldOption } from "./primitives";

const HELPER = "Mapping is remembered per account — the next file from it skips this step.";
const AWAITING =
  "Pick the account first — the duplicate check keys on it, so a file read against the wrong one duplicates every row.";
const UNSET = "—";

export interface FinanceImportColumnsCardProps {
  /** the file's own header names; empty until a statement is staged */
  headers: string[];
  mapping: FinanceColumnMapping | null;
  workedExample: MappingWorkedExample | null;
  accountOptions: SelectFieldOption[];
  accountId: string;
  onAccountChange: (accountId: string) => void;
  onRemap: (mapping: FinanceColumnMapping) => void;
}

interface ColumnCellProps {
  label: string;
  value: string;
  options: SelectFieldOption[];
  isDisabled: boolean;
  isMono?: boolean;
  onSelect: (value: string) => void;
}

function ColumnCell({ label, value, options, isDisabled, isMono, onSelect }: ColumnCellProps) {
  return (
    <div>
      <span className="mb-[5px] block text-[11.5px] text-muted">{label}</span>
      <SelectField
        label={`${label} column`}
        value={value}
        options={options}
        isDisabled={isDisabled}
        isMono={isMono}
        onSelect={onSelect}
      />
    </div>
  );
}

/**
 * Which column of the file feeds which field, said in four cells. The amount reads from one column
 * or from a debit/credit pair — a split pair is shown, not re-pointed, since collapsing it to a
 * single column would silently flip the sign of every credit.
 */
export function FinanceImportColumnsCard({
  headers,
  mapping,
  workedExample,
  accountOptions,
  accountId,
  onAccountChange,
  onRemap,
}: FinanceImportColumnsCardProps) {
  const columnOptions = headers.map((header) => ({ value: header, label: header }));
  const isSplitAmount = mapping !== null && mapping.amountColumn === null;
  const amountValue =
    mapping === null
      ? UNSET
      : (mapping.amountColumn ??
        `${mapping.debitColumn ?? UNSET} / ${mapping.creditColumn ?? UNSET}`);
  const accountName =
    accountOptions.find((option) => option.value === accountId)?.label ?? "No account";

  const repoint = (change: Partial<FinanceColumnMapping>) => {
    if (mapping) onRemap({ ...mapping, ...change });
  };

  return (
    <section className="rounded-[16px] border border-border bg-surface px-[18px] py-4 shadow-sm">
      <h2 className="mb-3 font-semibold text-[14px] text-foreground">Columns</h2>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <ColumnCell
          label="Date"
          value={mapping?.dateColumn ?? UNSET}
          options={columnOptions}
          isDisabled={mapping === null}
          isMono
          onSelect={(dateColumn) => repoint({ dateColumn })}
        />
        <ColumnCell
          label="Title"
          value={mapping?.descriptionColumn ?? UNSET}
          options={columnOptions}
          isDisabled={mapping === null}
          isMono
          onSelect={(descriptionColumn) => repoint({ descriptionColumn })}
        />
        <ColumnCell
          label="Amount"
          value={amountValue}
          options={columnOptions}
          isDisabled={mapping === null || isSplitAmount}
          isMono
          onSelect={(amountColumn) => repoint({ amountColumn })}
        />
        <ColumnCell
          label="Account"
          value={accountName}
          options={accountOptions}
          isDisabled={accountOptions.length === 0}
          onSelect={onAccountChange}
        />
      </div>

      <p className="mt-2.5 text-[12px] text-muted">{mapping === null ? AWAITING : HELPER}</p>
      {mapping !== null && (
        <p className="mt-1 text-[12px] text-muted tabular-nums">
          {describeWorkedExample(workedExample)}
        </p>
      )}
    </section>
  );
}
