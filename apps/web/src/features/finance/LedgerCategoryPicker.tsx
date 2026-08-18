import type { FinanceCategory } from "@vega/shared";
import { Menu, type MenuItem } from "@/core/ui";
import type { LedgerCategoryCell } from "./ledger-row";
import { CategoryChip } from "./primitives";

export interface LedgerCategoryPickerProps {
  cell: LedgerCategoryCell;
  /** Names the control for a screen reader, so every row's picker is distinguishable. */
  rowTitle: string;
  categories: FinanceCategory[];
  isLocked: boolean;
  onAssign: (categoryId: string | null) => void;
}

/**
 * The row's category, as a chip that opens a picker. A learned guess leads the menu rather than
 * needing its own affordance — one click on the chip either accepts the suggestion or overrides it.
 */
export function LedgerCategoryPicker({
  cell,
  rowTitle,
  categories,
  isLocked,
  onAssign,
}: LedgerCategoryPickerProps) {
  if (cell.tone === "exempt") return <span className="text-[12.5px] text-muted">{cell.label}</span>;

  const chip = <CategoryChip label={cell.label} tone={cell.tone} color={cell.color ?? undefined} />;
  if (isLocked) return chip;

  const suggestion: MenuItem[] =
    cell.suggestionId === null
      ? []
      : [
          {
            label: `Use ${cell.label}`,
            icon: "sparkles",
            onSelect: () => onAssign(cell.suggestionId),
          },
        ];
  const items: MenuItem[] = [
    ...suggestion,
    ...categories.map((category) => ({
      label: category.name,
      onSelect: () => onAssign(category.id),
    })),
    { label: "No category", onSelect: () => onAssign(null) },
  ];

  return (
    <Menu
      align="start"
      triggerLabel={`Category for ${rowTitle}`}
      triggerContent={chip}
      triggerClassName="rounded-[10px] p-0 hover:bg-transparent"
      items={items}
    />
  );
}
