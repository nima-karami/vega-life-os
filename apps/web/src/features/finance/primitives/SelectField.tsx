import { Dropdown } from "@heroui/react";
import { cx, Icon } from "@/core/ui";

export interface SelectFieldOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  /** names the control for a screen reader, and is what an e2e selector matches on */
  label: string;
  value: string;
  options: SelectFieldOption[];
  isDisabled?: boolean;
  /** a source column header reads in mono, the way it does in the provenance strip */
  isMono?: boolean;
  onSelect: (value: string) => void;
}

/**
 * The inline 36px field that opens a plain menu — a fixed list never justifies a combobox, and a
 * native `<select>` is not available here. Transparent, so it sits on a white card without a seam.
 */
export function SelectField({
  label,
  value,
  options,
  isDisabled = false,
  isMono = false,
  onSelect,
}: SelectFieldProps) {
  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={label}
        isDisabled={isDisabled}
        className={cx(
          "flex h-9 w-full items-center justify-between gap-2 rounded-[12px] border border-border bg-transparent px-3 text-[13px] text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
          isDisabled ? "opacity-50" : "hover:border-muted",
        )}
      >
        <span className={cx("truncate", isMono && "font-mono text-[12.5px]")}>{value}</span>
        <Icon name="chevrons-up-down" size={14} className="shrink-0 text-muted" aria-hidden />
      </Dropdown.Trigger>
      <Dropdown.Popover
        placement="bottom start"
        offset={6}
        className="rounded-[var(--radius-floating)]"
      >
        <Dropdown.Menu aria-label={label}>
          {options.map((option) => (
            <Dropdown.Item
              key={option.value}
              id={option.value}
              textValue={option.label}
              onAction={() => onSelect(option.value)}
              className="rounded-[var(--radius-floating-row)]"
            >
              {option.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
