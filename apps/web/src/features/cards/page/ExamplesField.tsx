import { Button } from "@heroui/react";
import type { SlotDef } from "@vega/shared";
import { useEffect, useState } from "react";
import { Icon, IconButton } from "@/core/ui";
import { FIELD_TEXT_CLASS } from "./field-classes";
import { canAddListItem, toStoredList } from "./slot-lists";

interface Row {
  id: string;
  value: string;
}

// Rows carry identity because two examples may hold the same text, and an index key would
// re-bind the wrong input the moment one is removed.
let rowSeq = 0;
const toRow = (value: string): Row => {
  rowSeq += 1;
  return { id: `r${rowSeq}`, value };
};
const readRows = (rows: Row[]): string[] => rows.map((row) => row.value);

export function ExamplesField({
  def,
  values,
  onChange,
}: {
  def: SlotDef;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const singular = def.label.replace(/s$/, "");
  const [rows, setRows] = useState<Row[]>(() => values.map(toRow));

  // An empty row a user is still typing into must survive; only stored values sync back in.
  useEffect(() => {
    setRows((current) =>
      toStoredList(readRows(current)).join("\0") === values.join("\0")
        ? current
        : values.map(toRow),
    );
  }, [values]);

  const commit = (next: Row[]) => {
    setRows(next);
    onChange(toStoredList(readRows(next)));
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-start gap-2">
          <input
            type="text"
            aria-label={`${singular} ${index + 1}`}
            value={row.value}
            maxLength={def.max}
            onChange={(event) =>
              commit(rows.map((r) => (r.id === row.id ? { ...r, value: event.target.value } : r)))
            }
            className={`${FIELD_TEXT_CLASS} min-w-0 flex-1`}
          />
          <IconButton
            name="close"
            size={15}
            label={`Remove ${singular.toLowerCase()} ${index + 1}`}
            className="h-11 w-11 shrink-0 rounded-[10px] sm:h-[34px] sm:w-[34px]"
            onPress={() => commit(rows.filter((r) => r.id !== row.id))}
          />
        </div>
      ))}
      {canAddListItem(readRows(rows), def) && (
        <Button
          size="sm"
          variant="ghost"
          onPress={() => commit([...rows, toRow("")])}
          className="mt-0.5 h-11 self-start font-medium text-accent text-sm sm:h-auto sm:text-[13px]"
        >
          <Icon name="plus" size={14} />
          {`Add ${singular.toLowerCase()}`}
        </Button>
      )}
    </div>
  );
}
