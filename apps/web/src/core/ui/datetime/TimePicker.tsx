import { Select as HSelect, ListBox } from "@heroui/react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { NONE, scrollSelectedIntoView } from "../select";
import { PickerField, triggerCx } from "./picker-field";

/** 15-minute-slot time picker on a HeroUI Select so the dropdown matches the field width
 * and gets standard a11y. value/onChange use "HH:mm" or null. */
export function TimePicker({
  label = "time",
  value,
  onChange,
  startHour = 5,
  endHour = 23,
  clearable = true,
}: {
  label?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  startHour?: number;
  endHour?: number;
  clearable?: boolean;
}) {
  const slots: string[] = [];
  for (let m = startHour * 60; m <= endHour * 60; m += 15) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }

  return (
    <PickerField label={label}>
      <HSelect
        aria-label={label}
        selectedKey={value ?? NONE}
        onSelectionChange={(k) => {
          if (k != null) onChange(k === NONE ? null : String(k));
        }}
        onOpenChange={(open) => {
          if (open) scrollSelectedIntoView();
        }}
        placeholder="No time"
      >
        <HSelect.Trigger
          className={cx(
            triggerCx,
            "h-auto min-h-0 rounded-none border-0 bg-transparent p-0 shadow-none",
          )}
        >
          <HSelect.Value />
          <Icon name="clock" size={13} className="shrink-0 text-[var(--color-muted)]" />
        </HSelect.Trigger>
        <HSelect.Popover className="w-[var(--trigger-width)] rounded-[10px]">
          <ListBox>
            {clearable ? (
              <ListBox.Item id={NONE} textValue="No time">
                No time
                <ListBox.Item.Indicator />
              </ListBox.Item>
            ) : null}
            {slots.map((t) => (
              <ListBox.Item id={t} key={t} textValue={t}>
                {t}
                <ListBox.Item.Indicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </HSelect.Popover>
      </HSelect>
    </PickerField>
  );
}
