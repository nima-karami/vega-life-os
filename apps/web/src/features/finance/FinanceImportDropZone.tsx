import { useRef, useState } from "react";
import { Icon, Select, type SelectOption } from "@/core/ui";

const ZONE_BASE =
  "mt-4 flex w-full flex-col items-center gap-2 rounded-[16px] border border-dashed px-4 py-12 text-center outline-none focus-visible:ring-2 focus-visible:ring-accent";

export interface FinanceImportDropZoneProps {
  accounts: SelectOption[];
  accountId: string;
  onAccountChange: (accountId: string) => void;
  onFiles: (files: FileList | null) => void;
  isDisabled: boolean;
  /** why the zone is closed, when it is */
  blockedReason?: string;
}

/**
 * The account is chosen before a file is ever read: the dedupe key carries the account slug,
 * so a statement dropped on the wrong account duplicates every row invisibly.
 */
export function FinanceImportDropZone({
  accounts,
  accountId,
  onAccountChange,
  onFiles,
  isDisabled,
  blockedReason,
}: FinanceImportDropZoneProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  return (
    <section className="mt-6">
      <div className="max-w-sm">
        <span className="text-xs text-muted">Account this statement belongs to</span>
        <div className="mt-1.5">
          <Select
            ariaLabel="Account"
            value={accountId}
            onValueChange={onAccountChange}
            options={accounts}
            placeholder="Choose an account…"
          />
        </div>
      </div>

      <button
        type="button"
        aria-label="Choose a statement file"
        disabled={isDisabled}
        onClick={() => fileInput.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsOver(false);
          if (!isDisabled) onFiles(event.dataTransfer.files);
        }}
        className={`${ZONE_BASE} ${isOver ? "border-accent" : "border-border"} ${
          isDisabled ? "opacity-50" : "hover:border-muted"
        }`}
      >
        <Icon name="upload" size={20} className="text-muted" />
        <span className="text-sm text-foreground">Drop a statement here, or press to browse</span>
        <span className="text-xs text-muted">
          CSV or TSV, one file at a time · up to 20 MB and 20,000 rows
        </span>
        {blockedReason && <span className="text-xs text-danger">{blockedReason}</span>}
      </button>

      <input
        ref={fileInput}
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </section>
  );
}
