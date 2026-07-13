import { Button } from "@heroui/react";
import { type ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatLongDate, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { type EntryFilter, type EntrySort, queryEntries } from "./entries";
import { type DayEntry, getEntryStatus, hasGratitude, MOOD_LABEL } from "./model";

const FIELD =
  "w-full rounded-[12px] border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent";

const FILTERS: { id: EntryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "journaled", label: "Journaled" },
  { id: "gratitude", label: "Gratitude" },
  { id: "mood", label: "With mood" },
];

const STATUS_LABEL = { none: "Empty", started: "Started", reflected: "Reflected" } as const;

/**
 * Entries manager — a browsable table of every day entry: search, filter, sort, and
 * click through to that date's editor. Reads the existing journal store (no new data).
 */
export function EntriesPage() {
  const journal = useStore((s) => s.journal);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EntryFilter>("all");
  const [sort, setSort] = useState<EntrySort>("newest");

  const rows = useMemo(
    () => queryEntries(journal, { query, filter, sort }),
    [journal, query, filter, sort],
  );

  const isEmpty = journal.length === 0;
  const clearFilters = () => {
    setQuery("");
    setFilter("all");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Entries</h1>
          <p className="mt-1 text-sm text-muted">
            Every journal, gratitude, and mood you've logged.
          </p>
        </div>
        <Button variant="primary" onPress={() => navigate(`/journal/${todayISO()}`)}>
          <Icon name="notebook-pen" size={15} />
          Today's entry
        </Button>
      </header>

      {!isEmpty && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entries…"
              aria-label="Search entries"
              className={FIELD}
            />
          </div>
          <fieldset className="flex flex-wrap gap-1.5" aria-label="Filter entries">
            {FILTERS.map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={cx(
                  "rounded-[10px] border px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  filter === f.id
                    ? "border-accent text-foreground"
                    : "border-border text-muted hover:border-muted",
                )}
              >
                {f.label}
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
            className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-sm text-muted outline-none hover:border-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Sort by date, ${sort === "newest" ? "newest first" : "oldest first"}`}
          >
            <Icon name={sort === "newest" ? "chevD" : "chevU"} size={14} />
            {sort === "newest" ? "Newest" : "Oldest"}
          </button>
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          title="No entries yet"
          body="Your journal, gratitude, and mood entries will collect here."
          cta={
            <Button variant="primary" onPress={() => navigate(`/journal/${todayISO()}`)}>
              Start today's entry
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No entries match"
          body="Try a different search or filter."
          cta={
            <Button variant="secondary" onPress={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <ul className="min-w-[640px] divide-y divide-border rounded-[16px] border border-border bg-surface">
            {rows.map((e) => (
              <li key={e.id}>
                <EntryRow entry={e} onOpen={() => navigate(`/journal/${e.date}`)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry, onOpen }: { entry: DayEntry; onOpen: () => void }) {
  const status = getEntryStatus(entry);
  const gratCount = entry.gratitude.filter((g) => g.trim() !== "").length;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open entry for ${formatLongDate(entry.date)}`}
      className="grid w-full grid-cols-[9rem_4rem_1fr_1fr_6rem] items-center gap-3 px-4 py-3 text-left outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
    >
      <span className="text-sm font-medium text-foreground">{formatLongDate(entry.date)}</span>
      <span className="text-sm text-muted">
        {entry.mood != null ? (
          <span title={MOOD_LABEL[entry.mood]} className="tabular-nums">
            {entry.mood}/5
          </span>
        ) : (
          "—"
        )}
      </span>
      <span className="truncate text-sm text-muted">
        {hasGratitude(entry) ? `${gratCount}· ${entry.gratitude.find((g) => g.trim())}` : "—"}
      </span>
      <span className="truncate text-sm text-muted">{entry.journal.trim() || "—"}</span>
      <span
        className={cx(
          "justify-self-start rounded-full px-2 py-0.5 text-xs",
          status === "reflected"
            ? "bg-accent/10 text-accent"
            : status === "started"
              ? "bg-surface-secondary text-foreground"
              : "text-muted",
        )}
      >
        {STATUS_LABEL[status]}
      </span>
    </button>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta: ReactNode }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 rounded-[16px] border border-dashed border-border py-16 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      <div className="mt-2">{cta}</div>
    </div>
  );
}
