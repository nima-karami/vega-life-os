import { format, parseISO } from "date-fns";
import { Icon } from "../icons";
import { CalendarPopover } from "./CalendarPopover";
import { PickerField, triggerCx } from "./picker-field";

/** Custom calendar-grid date picker. value/onChange use ISO yyyy-mm-dd or null. */
export function DatePicker({
  label = "date",
  ariaLabel,
  value,
  onChange,
}: {
  label?: string;
  ariaLabel?: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <PickerField label={label}>
      <CalendarPopover
        value={value}
        onChange={onChange}
        align="start"
        triggerLabel={ariaLabel}
        triggerClassName={triggerCx}
        triggerContent={
          <>
            <span className={value ? "" : "text-[var(--color-muted)]"}>
              {value ? format(parseISO(value), "EEE · MMM d, yyyy") : "No date"}
            </span>
            <Icon name="calendar" size={13} className="shrink-0 text-[var(--color-muted)]" />
          </>
        }
      />
    </PickerField>
  );
}
