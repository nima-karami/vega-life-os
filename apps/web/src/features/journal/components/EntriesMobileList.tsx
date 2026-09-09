import { formatLongDate } from "@/core/lib/date";
import { cx, Icon } from "@/core/ui";
import { EMPTY_FIELD, ENTRY_STATUS_LABEL, summarizeGratitude, summarizeJournal } from "../entries";
import { type DayEntry, type EntryStatus, getEntryStatus, MOOD_LABEL } from "../model";

const STATUS_ICON = {
  none: "minus-circle",
  started: "notebook-pen",
  reflected: "check",
} as const satisfies Record<EntryStatus, string>;

export function EntriesMobileList({
  rows,
  onOpen,
}: {
  rows: DayEntry[];
  onOpen: (entry: DayEntry) => void;
}) {
  return (
    <ul className="mt-4 divide-y divide-border rounded-[16px] border border-border bg-surface">
      {rows.map((entry) => (
        <li key={entry.id}>
          <EntryStack entry={entry} onOpen={() => onOpen(entry)} />
        </li>
      ))}
    </ul>
  );
}

function EntryStack({ entry, onOpen }: { entry: DayEntry; onOpen: () => void }) {
  const status = getEntryStatus(entry);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open entry for ${formatLongDate(entry.date)}`}
      className="flex w-full flex-col gap-1 px-4 py-3 text-left outline-none active:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium text-[15px] text-foreground">
          {formatLongDate(entry.date)}
        </span>
        <span
          className={cx(
            "flex shrink-0 items-center gap-1 text-xs",
            status === "reflected"
              ? "text-accent"
              : status === "started"
                ? "text-foreground"
                : "text-muted",
          )}
        >
          <Icon name={STATUS_ICON[status]} size={13} />
          {ENTRY_STATUS_LABEL[status]}
        </span>
      </span>

      <span className="flex items-center gap-2 text-muted text-sm">
        {entry.mood != null ? (
          <span className="shrink-0 tabular-nums" title={MOOD_LABEL[entry.mood]}>
            {entry.mood}/5
          </span>
        ) : (
          <span className="shrink-0">{EMPTY_FIELD}</span>
        )}
        <span className="min-w-0 flex-1 truncate">{summarizeGratitude(entry)}</span>
      </span>

      <span className="truncate text-muted text-sm">{summarizeJournal(entry)}</span>
    </button>
  );
}
