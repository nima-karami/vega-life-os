import type { FinanceColumnMapping } from "@vega/shared";
import { useState } from "react";
import { FinanceImportColumnsCard } from "./FinanceImportColumnsCard";
import { FinanceImportDropZone, type FinanceImportDropZoneProps } from "./FinanceImportDropZone";
import { FinanceImportOutcomeTable } from "./FinanceImportOutcomeTable";
import type { MappingWorkedExample } from "./import/types";
import {
  buildImportOutcomeLenses,
  type ImportOutcome,
  type ImportOutcomeCounts,
  type ImportPreviewRow,
} from "./import-preview";
import type { SelectFieldOption } from "./primitives";

export interface FinanceImportStageProps {
  dropZone: FinanceImportDropZoneProps;
  headers: string[];
  mapping: FinanceColumnMapping | null;
  workedExample: MappingWorkedExample | null;
  accountOptions: SelectFieldOption[];
  accountId: string;
  counts: ImportOutcomeCounts;
  rows: ImportPreviewRow[];
  onAccountChange: (accountId: string) => void;
  onRemap: (mapping: FinanceColumnMapping) => void;
}

/** The left column: the file, how it is read, and what reading it that way would do. */
export function FinanceImportStage({
  dropZone,
  headers,
  mapping,
  workedExample,
  accountOptions,
  accountId,
  counts,
  rows,
  onAccountChange,
  onRemap,
}: FinanceImportStageProps) {
  const [lens, setLens] = useState<ImportOutcome>("will-add");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <FinanceImportDropZone {...dropZone} />

      <FinanceImportColumnsCard
        headers={headers}
        mapping={mapping}
        workedExample={workedExample}
        accountOptions={accountOptions}
        accountId={accountId}
        onAccountChange={onAccountChange}
        onRemap={onRemap}
      />

      {mapping !== null && (
        <FinanceImportOutcomeTable
          rows={rows}
          lenses={buildImportOutcomeLenses(counts)}
          activeLens={lens}
          onLensChange={setLens}
        />
      )}
    </div>
  );
}
