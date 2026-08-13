import { ListBox } from "@heroui/react";
import type { Key } from "react";
import { Icon } from "@/core/ui";
import { POPOVER_ROW_CLASS } from "./cell-styles";

export interface PickerOption {
  id: string;
  label: string;
  isDisabled?: boolean;
}

/** Type and Learning are fixed lists, so they open a plain menu with a check on the current value. */
export function FixedListPicker({
  options,
  selectedId,
  ariaLabel,
  onSelect,
}: {
  options: readonly PickerOption[];
  selectedId: string;
  ariaLabel: string;
  onSelect: (id: string) => void;
}) {
  const disabledKeys = options.filter((option) => option.isDisabled).map((option) => option.id);

  return (
    <ListBox
      aria-label={ariaLabel}
      selectionMode="single"
      selectedKeys={[selectedId]}
      disabledKeys={disabledKeys}
      className="w-[190px]"
      onSelectionChange={(keys) => {
        const [first] = [...(keys as Set<Key>)];
        if (first != null) onSelect(String(first));
      }}
    >
      {options.map((option) => (
        <ListBox.Item
          key={option.id}
          id={option.id}
          textValue={option.label}
          className={`${POPOVER_ROW_CLASS} justify-between data-[selected=true]:bg-surface-secondary`}
        >
          {option.label}
          <ListBox.Item.Indicator>
            <Icon name="check" size={14} className="text-accent" />
          </ListBox.Item.Indicator>
        </ListBox.Item>
      ))}
    </ListBox>
  );
}
