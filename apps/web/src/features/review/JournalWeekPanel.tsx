import { format } from "date-fns";
import { Link } from "react-router";
import { Panel, SectionHead } from "@/core/ui";
import { type DayEntry, MOOD_LABEL } from "@/features/journal/model";
import { getWeekEntries } from "@/features/journal/selectors";

function describeJournalDay(entry: DayEntry, dayLabel: string): string {
  if (entry.mood != null) return `${dayLabel} — ${MOOD_LABEL[entry.mood]}`;
  const gratitudeCount = entry.gratitude.filter((g) => g.trim() !== "").length;
  if (gratitudeCount > 0) {
    return `${dayLabel} — ${gratitudeCount} gratitude item${gratitudeCount === 1 ? "" : "s"}`;
  }
  return `${dayLabel} — journal entry`;
}

export function JournalWeekPanel({
  journal,
  weekIsos,
}: {
  journal: DayEntry[];
  weekIsos: string[];
}) {
  const entries = getWeekEntries(journal, weekIsos);
  return (
    <Panel className="p-4 sm:p-5">
      <SectionHead
        title="Journal"
        meta={entries.length ? `${entries.length} of 7 days` : "empty"}
      />
      {entries.length ? (
        <ul className="mt-3 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <JournalDayRow entry={entry} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No journal entries this week.</p>
      )}
      <Link
        to="/entries"
        className="mt-3 inline-block rounded-[8px] text-sm text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        View all entries
      </Link>
    </Panel>
  );
}

function JournalDayRow({ entry }: { entry: DayEntry }) {
  const dayLabel = format(new Date(`${entry.date}T00:00:00`), "EEE MMM d");
  const gratitudeItems = entry.gratitude.filter((g) => g.trim() !== "");
  const journalText = entry.journal.trim();
  return (
    <Link
      to={`/journal/${entry.date}`}
      aria-label={describeJournalDay(entry, dayLabel)}
      className="block rounded-[10px] px-2 py-1.5 outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="text-sm font-medium text-foreground">{dayLabel}</span>
      {entry.mood != null && <p className="mt-0.5 text-xs text-muted">{MOOD_LABEL[entry.mood]}</p>}
      {gratitudeItems.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {gratitudeItems.map((g) => (
            <li key={g} className="text-xs text-muted">
              {g}
            </li>
          ))}
        </ul>
      )}
      {journalText && <p className="mt-1 line-clamp-2 text-xs text-muted">{journalText}</p>}
    </Link>
  );
}
