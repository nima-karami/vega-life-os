import { Button } from "@heroui/react";
import type { FinanceTransaction } from "@vega/shared";
import { EditorField, Icon, NONE, Select, type SelectOption } from "@/core/ui";
import { DraftInput } from "./DraftInput";
import { parseShareBps } from "./money";

export interface TransactionsBulkBarProps {
  selectedCount: number;
  lockedCount: number;
  categoryOptions: SelectOption[];
  onPatchSelection: (patch: Partial<FinanceTransaction>) => void;
  onDeleteSelection: () => void;
  onClear: () => void;
}

const FLAG_ACTIONS: {
  label: string;
  icon: "home" | "layers";
  patch: Partial<FinanceTransaction>;
}[] = [
  { label: "Mark household", icon: "home", patch: { isHousehold: true } },
  { label: "Unmark household", icon: "home", patch: { isHousehold: false } },
  { label: "Mark internal", icon: "layers", patch: { isInternal: true } },
  { label: "Unmark internal", icon: "layers", patch: { isInternal: false } },
];

/**
 * The toolbar over a selection. Every action applies to the whole selection at once — with ~1,000
 * rows, anything that has to be done one row at a time is not usable.
 */
export function TransactionsBulkBar({
  selectedCount,
  lockedCount,
  categoryOptions,
  onPatchSelection,
  onDeleteSelection,
  onClear,
}: TransactionsBulkBarProps) {
  const editableCount = selectedCount - lockedCount;

  return (
    <div className="sticky top-0 z-10 mt-4 flex flex-wrap items-end gap-3 rounded-[16px] border border-border bg-surface px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span aria-live="polite" className="text-sm font-medium text-foreground tabular-nums">
          {selectedCount} selected
        </span>
        {lockedCount > 0 && (
          <span className="text-xs text-danger tabular-nums">
            {lockedCount} in a settled month — left untouched
          </span>
        )}
      </div>

      <EditorField label="Set category" className="w-48">
        <Select
          ariaLabel="Set category for selection"
          value=""
          placeholder="Choose…"
          options={categoryOptions}
          onValueChange={(next) => onPatchSelection({ categoryId: next === NONE ? null : next })}
        />
      </EditorField>

      <EditorField label="Set share %" className="w-28">
        <DraftInput
          type="number"
          min={0}
          max={100}
          step={0.01}
          ariaLabel="Set share percent for selection"
          value=""
          placeholder="50"
          // one-shot: applied to the selection, then the field clears for the next value
          onCommit={(raw) => {
            const bps = parseShareBps(raw);
            if (bps !== null) onPatchSelection({ isHousehold: true, myShareBps: bps });
            return false;
          }}
        />
      </EditorField>

      <div className="flex flex-wrap items-center gap-2">
        {FLAG_ACTIONS.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant="secondary"
            isDisabled={editableCount === 0}
            onPress={() => onPatchSelection(action.patch)}
          >
            <Icon name={action.icon} size={14} />
            {action.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="danger-soft"
          isDisabled={editableCount === 0}
          onPress={onDeleteSelection}
        >
          <Icon name="trash" size={14} />
          Delete
        </Button>
        <Button size="sm" variant="ghost" onPress={onClear}>
          Clear selection
        </Button>
      </div>
    </div>
  );
}
