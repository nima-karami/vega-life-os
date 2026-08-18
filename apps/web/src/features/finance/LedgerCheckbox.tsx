import { Checkbox } from "@heroui/react";
import { cx, Icon } from "@/core/ui";

/**
 * The selection box, drawn from the `isSelected` prop rather than a CSS state hook — the stock
 * control renders its check at full opacity whether or not the row is selected.
 */
export function LedgerCheckbox({
  isSelected,
  label,
  onToggle,
}: {
  isSelected: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Checkbox isSelected={isSelected} onChange={onToggle} aria-label={label}>
      <Checkbox.Content>
        <Checkbox.Control
          className={cx(
            "grid size-4 place-items-center rounded-[5px] border-[1.5px]",
            isSelected
              ? "border-accent bg-accent text-white"
              : "border-black/20 bg-surface text-transparent",
          )}
        >
          <Checkbox.Indicator>
            <Icon name="check" size={11} />
          </Checkbox.Indicator>
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}
