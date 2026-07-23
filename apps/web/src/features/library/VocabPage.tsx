import { Button } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { formatLongDate, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { ConfirmDialog, cx, EmptyState, Icon, SortHeader, toggleColumnSort } from "@/core/ui";
import { listVocabExamples, type VocabEntry } from "./model";
import {
  computeVocabStats,
  DEFAULT_VOCAB_SORT,
  isVocabDue,
  queryVocab,
  type VocabFilter,
  type VocabSort,
  type VocabSortColumn,
} from "./queries";
import { VocabEditorModal } from "./VocabEditorModal";

const FIELD =
  "w-full rounded-[12px] border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent";

const CHIP_BASE =
  "rounded-[10px] border px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
const CHIP_ON = "border-accent text-foreground";
const CHIP_OFF = "border-border text-muted hover:border-muted";

const FILTERS: { id: VocabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "due", label: "Due" },
];

const GRID_COLS = "grid-cols-[2rem_1fr_7rem_4.5rem_7rem_6rem_4.5rem]";

const SORT_COLUMNS: { column: VocabSortColumn; label: string }[] = [
  { column: "term", label: "Term" },
  { column: "language", label: "Language" },
  { column: "box", label: "Box" },
  { column: "due", label: "Due" },
  { column: "addedAt", label: "Added" },
];

export function VocabPage() {
  const vocab = useStore((s) => s.vocab);
  const removeVocab = useStore((s) => s.removeVocab);
  const pendingVocabTerm = useStore((s) => s.pendingVocabTerm);
  const setPendingVocabTerm = useStore((s) => s.setPendingVocabTerm);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VocabFilter>("all");
  const [sort, setSort] = useState<VocabSort>(DEFAULT_VOCAB_SORT);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorEntryId, setEditorEntryId] = useState<string | null>(null);
  const [prefillTerm, setPrefillTerm] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VocabEntry | null>(null);

  const today = todayISO();
  const rows = useMemo(
    () => queryVocab(vocab, { query, filter, sort, today }),
    [vocab, query, filter, sort, today],
  );
  const stats = useMemo(() => computeVocabStats(vocab, today), [vocab, today]);

  const isEmpty = vocab.length === 0;

  const openEditor = (entryId: string | null) => {
    setEditorEntryId(entryId);
    setPrefillTerm("");
    setIsEditorOpen(true);
  };
  const clearFilters = () => {
    setQuery("");
    setFilter("all");
  };
  const handleSortColumn = (column: VocabSortColumn) => {
    setSort((current) => toggleColumnSort(current, column, ["addedAt"]));
  };
  const handleDeleteConfirmed = () => {
    if (pendingDelete) removeVocab(pendingDelete.id);
    setPendingDelete(null);
  };

  useEffect(() => {
    if (pendingVocabTerm === null) return;
    setEditorEntryId(null);
    setPrefillTerm(pendingVocabTerm);
    setIsEditorOpen(true);
    setPendingVocabTerm(null);
  }, [pendingVocabTerm, setPendingVocabTerm]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Vocabulary</h1>
          <p className="mt-1 text-sm text-muted">
            Words you're learning — each one cycles through the scroll feed.
          </p>
          <p className="mt-2 text-sm text-muted tabular-nums">
            {stats.words} words · {stats.dueToday} due today
          </p>
        </div>
        <Button variant="primary" onPress={() => openEditor(null)}>
          <Icon name="plus" size={15} />
          New word
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search words…"
              aria-label="Search words"
              className={FIELD}
            />
          </div>
          <fieldset className="flex flex-wrap gap-1.5" aria-label="Filter words">
            {FILTERS.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => setFilter(option.id)}
                aria-pressed={filter === option.id}
                className={cx(CHIP_BASE, filter === option.id ? CHIP_ON : CHIP_OFF)}
              >
                {option.label}
              </button>
            ))}
          </fieldset>
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          title="No words yet"
          body="Build your word list — every word joins the feed for spaced review."
          cta={
            <Button variant="primary" onPress={() => openEditor(null)}>
              Add your first word
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No words match"
          body="Try a different search or filter."
          cta={
            <Button variant="secondary" onPress={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className={cx("grid min-w-[640px] items-center gap-3 px-2 pb-1.5", GRID_COLS)}>
            <span />
            <SortHeader columns={SORT_COLUMNS} sort={sort} onSort={handleSortColumn} />
            <span />
          </div>
          <ul className="min-w-[640px] divide-y divide-border rounded-[16px] border border-border bg-surface">
            {rows.map((word) => (
              <li key={word.id}>
                <VocabRow
                  word={word}
                  isDue={isVocabDue(word, today)}
                  isExpanded={expandedId === word.id}
                  onOpen={() => openEditor(word.id)}
                  onToggleExpand={() =>
                    setExpandedId((current) => (current === word.id ? null : word.id))
                  }
                  onDelete={() => setPendingDelete(word)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <VocabEditorModal
        entryId={editorEntryId}
        prefillTerm={prefillTerm}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        danger
        title="Delete word?"
        body={pendingDelete ? `"${pendingDelete.term}" will be removed for good.` : ""}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirmed}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

function VocabRow({
  word,
  isDue,
  isExpanded,
  onOpen,
  onToggleExpand,
  onDelete,
}: {
  word: VocabEntry;
  isDue: boolean;
  isExpanded: boolean;
  onOpen: () => void;
  onToggleExpand: () => void;
  onDelete: () => void;
}) {
  const examples = listVocabExamples(word);
  const synonyms = word.synonyms ?? [];
  return (
    <div>
      <div className={cx("grid items-center gap-3 px-2 py-1.5", GRID_COLS)}>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={isExpanded ? `Collapse ${word.term}` : `Preview ${word.term}`}
          aria-expanded={isExpanded}
          className="justify-self-center rounded p-1.5 text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name={isExpanded ? "chevU" : "chevD"} size={14} />
        </button>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Edit ${word.term || "untitled word"}`}
          className="truncate text-left text-sm font-medium text-foreground outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
        >
          {word.term || "Untitled"}
        </button>
        <span className="truncate text-sm text-muted">{word.language || "—"}</span>
        <span className="text-sm text-muted tabular-nums">box {word.box}</span>
        <span
          className={cx(
            "justify-self-start rounded-full px-2 py-0.5 text-xs tabular-nums",
            isDue ? "bg-accent/10 text-accent" : "text-muted",
          )}
        >
          {word.nextDue ? formatLongDate(word.nextDue) : "—"}
        </span>
        <span className="text-xs text-muted tabular-nums">{formatLongDate(word.addedAt)}</span>
        <span className="flex justify-self-center">
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${word.term}`}
            className="rounded p-1.5 text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name="trash" size={14} />
          </button>
        </span>
      </div>
      {isExpanded && (
        <div className="space-y-2 border-t border-border bg-surface-secondary px-4 py-3">
          {word.phonetic && <p className="text-sm text-muted">{word.phonetic}</p>}
          <p className="text-sm text-foreground">{word.definition || "No definition yet."}</p>
          {examples.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {examples.map((example) => (
                <li key={example} className="text-sm text-muted">
                  {example}
                </li>
              ))}
            </ul>
          )}
          {synonyms.length > 0 && (
            <p className="text-sm text-muted">Synonyms: {synonyms.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
