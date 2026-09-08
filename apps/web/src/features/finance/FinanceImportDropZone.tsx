import { useState } from "react";
import { cx, Icon } from "@/core/ui";

const IDLE_LINE = "Drop a statement here, or choose a file.";
const IDLE_HINT = "CSV or TSV, one file at a time · up to 20 MB and 20,000 rows.";
const STAGED_HINT = "Drop another file to replace it. Nothing is written until you import.";

export interface FinanceImportDropZoneProps {
  /** the staged file's own line — absent until something has been read */
  fileName: string | null;
  fileMeta: string;
  onFiles: (files: FileList | null) => void;
  isDisabled: boolean;
  /** why the zone is closed, when it is */
  blockedReason?: string;
  /** an earlier batch carried this exact file */
  priorImportNote?: string;
  /** the file's merchants are strangers to the chosen account */
  mismatchNote?: string;
  /** overrides the module's idle hint — the zero-account state says what to do instead */
  idleHint?: string;
  /** a drop the shut zone swallowed, so it is answered rather than handed to the browser */
  onBlockedDrop?: (files: FileList | null) => void;
}

/**
 * The file block: what was read, that nothing has been written, and how to replace it. The input
 * itself covers the block, so the whole dashed area is one control rather than a decorated div.
 */
export function FinanceImportDropZone({
  fileName,
  fileMeta,
  onFiles,
  isDisabled,
  blockedReason,
  priorImportNote,
  mismatchNote,
  idleHint,
  onBlockedDrop,
}: FinanceImportDropZoneProps) {
  const [isOver, setIsOver] = useState(false);

  return (
    <fieldset
      aria-label="Statement file"
      className="relative min-w-0"
      onDragOver={(event) => {
        if (isDisabled) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!isDisabled) return;
        event.preventDefault();
        onBlockedDrop?.(event.dataTransfer.files);
      }}
    >
      <input
        type="file"
        aria-label="Choose a statement file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        disabled={isDisabled}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        onDragOver={() => setIsOver(true)}
        onDragLeave={() => setIsOver(false)}
        onDrop={() => setIsOver(false)}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <section
        className={cx(
          "flex flex-col items-start gap-3 rounded-[16px] border border-dashed p-5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent sm:flex-row sm:items-center sm:gap-3.5",
          isOver ? "border-accent bg-canvas" : "border-line-strong bg-surface",
          isDisabled && "opacity-60",
        )}
      >
        <Icon name="file-input" size={20} className="shrink-0 text-muted" aria-hidden />

        <div className="min-w-0 w-full flex-1">
          <p className="truncate font-medium text-[14px] text-foreground">
            {fileName ?? IDLE_LINE}
            {fileName !== null && <span className="font-normal text-muted"> · {fileMeta}</span>}
          </p>
          <p className="mt-[3px] text-[12.5px] text-muted">
            {fileName === null ? (idleHint ?? IDLE_HINT) : STAGED_HINT}
          </p>
          {priorImportNote && (
            <p data-testid="import-prior-file" className="mt-[3px] text-[12.5px] text-warning">
              {priorImportNote}
            </p>
          )}
          {mismatchNote && <p className="mt-[3px] text-[12.5px] text-warning">{mismatchNote}</p>}
          {blockedReason && <p className="mt-[3px] text-[12.5px] text-danger">{blockedReason}</p>}
        </div>

        <span className="inline-flex h-8 shrink-0 items-center rounded-[12px] border border-border bg-surface px-3.5 font-semibold text-[12.5px] text-foreground">
          Choose file
        </span>
      </section>
    </fieldset>
  );
}
