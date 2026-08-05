import { Button, Modal, useOverlayState } from "@heroui/react";
import type { FinanceColumnMapping } from "@vega/shared";
import { useMemo, useRef, useState } from "react";
import { draftSafeBackdrop, NONE, Select, useCompactModal } from "@/core/ui";
import { FinanceWorkedExample } from "./FinanceWorkedExample";
import {
  FINANCE_DATE_FORMATS,
  type FinanceDateFormat,
  formatDateLabel,
  isFinanceDateFormat,
  type MappingWorkedExample,
  parseAmountCents,
  parseStatementDate,
  type TableData,
  type TableView,
  viewTable,
} from "./import";

const PREVIEW_ROWS = 3;

interface MapperDraft {
  hasHeaderRow: boolean;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  debitColumn: string;
  creditColumn: string;
  dateFormat: FinanceDateFormat;
  debitsArePositive: boolean;
}

const emptyDraft = (hasHeaderRow: boolean): MapperDraft => ({
  hasHeaderRow,
  dateColumn: "",
  descriptionColumn: "",
  amountColumn: NONE,
  debitColumn: NONE,
  creditColumn: NONE,
  dateFormat: "MM/DD/YYYY",
  debitsArePositive: false,
});

const fromMapping = (mapping: FinanceColumnMapping): MapperDraft => ({
  hasHeaderRow: mapping.hasHeaderRow,
  dateColumn: mapping.dateColumn,
  descriptionColumn: mapping.descriptionColumn,
  amountColumn: mapping.amountColumn ?? NONE,
  debitColumn: mapping.debitColumn ?? NONE,
  creditColumn: mapping.creditColumn ?? NONE,
  dateFormat: isFinanceDateFormat(mapping.dateFormat) ? mapping.dateFormat : "MM/DD/YYYY",
  debitsArePositive: mapping.debitsArePositive,
});

const toMapping = (draft: MapperDraft): FinanceColumnMapping => ({
  dateColumn: draft.dateColumn,
  descriptionColumn: draft.descriptionColumn,
  amountColumn: draft.amountColumn === NONE ? null : draft.amountColumn,
  debitColumn: draft.debitColumn === NONE ? null : draft.debitColumn,
  creditColumn: draft.creditColumn === NONE ? null : draft.creditColumn,
  dateFormat: draft.dateFormat,
  debitsArePositive: draft.debitsArePositive,
  hasHeaderRow: draft.hasHeaderRow,
});

const isComplete = (draft: MapperDraft) =>
  draft.dateColumn !== "" &&
  draft.descriptionColumn !== "" &&
  (draft.amountColumn !== NONE || draft.debitColumn !== NONE);

const cellAt = (view: TableView, column: string) => {
  const index = view.headers.indexOf(column);
  return index === -1 ? "" : (view.rows[0]?.cells[index] ?? "");
};

/** The same figures the preview gate shows, recomputed live so the mapping is judged as it is set. */
function previewExample(draft: MapperDraft, view: TableView): MappingWorkedExample | null {
  const rawDate = cellAt(view, draft.dateColumn);
  const amountColumn = draft.amountColumn === NONE ? draft.debitColumn : draft.amountColumn;
  const rawAmount = cellAt(view, amountColumn);
  const txnDate = parseStatementDate(rawDate, draft.dateFormat);
  const parsed = parseAmountCents(rawAmount);
  if (txnDate === null || parsed === null) return null;
  const amountCents = draft.debitsArePositive ? -parsed : parsed;
  return {
    rawDate,
    txnDate,
    dateLabel: `${formatDateLabel(txnDate)} (${draft.dateFormat})`,
    rawAmount,
    amountCents,
    directionLabel: amountCents < 0 ? "money out" : "money in",
  };
}

export interface FinanceImportMapperProps {
  isOpen: boolean;
  fileName: string;
  table: TableData;
  initial: FinanceColumnMapping | null;
  /** the last mapping was tried and its columns did not fit the file */
  retryReason?: string;
  onCancel: () => void;
  onConfirm: (mapping: FinanceColumnMapping) => void;
}

/**
 * Only RBC's layout is in the registry, so most of the accounts land here on their first
 * import. The mapping is remembered on the account afterwards and this screen is not seen again.
 */
export function FinanceImportMapper({
  isOpen,
  fileName,
  table,
  initial,
  retryReason,
  onCancel,
  onConfirm,
}: FinanceImportMapperProps) {
  const [draft, setDraft] = useState<MapperDraft>(() =>
    initial ? fromMapping(initial) : emptyDraft(table.hasHeaderRow),
  );

  const shownFile = useRef(fileName);
  if (shownFile.current !== fileName) {
    shownFile.current = fileName;
    setDraft(initial ? fromMapping(initial) : emptyDraft(table.hasHeaderRow));
  }

  const view = useMemo(() => viewTable(table, draft.hasHeaderRow), [table, draft.hasHeaderRow]);
  const columns = view.headers.map((header) => ({ value: header, label: header }));
  const optional = [{ value: NONE, label: "None" }, ...columns];
  const patch = (change: Partial<MapperDraft>) => setDraft((prior) => ({ ...prior, ...change }));
  const readHeaderRow = (hasHeaderRow: boolean) =>
    patch({ ...emptyDraft(hasHeaderRow), dateFormat: draft.dateFormat });

  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onCancel();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur" {...draftSafeBackdrop}>
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label="Map statement columns">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold text-foreground">
                Map the columns in {fileName}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="space-y-5">
              <p className="text-xs text-muted">
                This layout isn’t one we know yet. Point out the columns once — the account
                remembers them for every import after this.
              </p>
              {retryReason && <p className="text-xs text-danger">{retryReason}</p>}

              <div className="space-y-2">
                <span className="text-xs text-muted">The first line of the file holds</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={draft.hasHeaderRow ? "primary" : "outline"}
                    aria-pressed={draft.hasHeaderRow}
                    isDisabled={!table.hasHeaderRow}
                    onPress={() => readHeaderRow(true)}
                  >
                    Column headers
                  </Button>
                  <Button
                    size="sm"
                    variant={draft.hasHeaderRow ? "outline" : "primary"}
                    aria-pressed={!draft.hasHeaderRow}
                    onPress={() => readHeaderRow(false)}
                  >
                    A transaction
                  </Button>
                </div>
                {!table.hasHeaderRow && (
                  <p className="text-xs text-muted">
                    Its first line reads as a date and an amount, so it is kept as data and the
                    columns are numbered.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <span className="text-xs text-muted">Date</span>
                  <Select
                    ariaLabel="Date column"
                    value={draft.dateColumn}
                    onValueChange={(dateColumn) => patch({ dateColumn })}
                    options={columns}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted">Description</span>
                  <Select
                    ariaLabel="Description column"
                    value={draft.descriptionColumn}
                    onValueChange={(descriptionColumn) => patch({ descriptionColumn })}
                    options={columns}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted">Amount</span>
                  <Select
                    ariaLabel="Amount column"
                    value={draft.amountColumn}
                    onValueChange={(amountColumn) => patch({ amountColumn })}
                    options={optional}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted">Debit, if split in two</span>
                  <Select
                    ariaLabel="Debit column"
                    value={draft.debitColumn}
                    onValueChange={(debitColumn) => patch({ debitColumn })}
                    options={optional}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted">Credit, if split in two</span>
                  <Select
                    ariaLabel="Credit column"
                    value={draft.creditColumn}
                    onValueChange={(creditColumn) => patch({ creditColumn })}
                    options={optional}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted">Date format</span>
                  <Select
                    ariaLabel="Date format"
                    value={draft.dateFormat}
                    onValueChange={(value) => {
                      if (isFinanceDateFormat(value)) patch({ dateFormat: value });
                    }}
                    options={FINANCE_DATE_FORMATS.map((value) => ({ value, label: value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs text-muted">A debit in this file is written as</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={draft.debitsArePositive ? "outline" : "primary"}
                    aria-pressed={!draft.debitsArePositive}
                    onPress={() => patch({ debitsArePositive: false })}
                  >
                    A negative number
                  </Button>
                  <Button
                    size="sm"
                    variant={draft.debitsArePositive ? "primary" : "outline"}
                    aria-pressed={draft.debitsArePositive}
                    onPress={() => patch({ debitsArePositive: true })}
                  >
                    A positive number
                  </Button>
                </div>
              </div>

              <div className="rounded-[12px] border border-border px-3 py-2.5">
                <FinanceWorkedExample example={previewExample(draft, view)} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted">
                    <tr>
                      {view.headers.map((header) => (
                        <th key={header} className="whitespace-nowrap px-2 py-1 font-normal">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-foreground">
                    {view.rows.slice(0, PREVIEW_ROWS).map((row) => (
                      <tr key={row.line}>
                        {view.headers.map((header, index) => (
                          <td key={header} className="whitespace-nowrap px-2 py-1 tabular-nums">
                            {row.cells[index] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Modal.Body>

            <Modal.Footer className="justify-end gap-2">
              <Button size="sm" variant="ghost" onPress={onCancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                isDisabled={!isComplete(draft)}
                onPress={() => onConfirm(toMapping(draft))}
              >
                Confirm mapping
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
