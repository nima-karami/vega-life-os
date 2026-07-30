import { Button } from "@heroui/react";
import { useMemo, useState } from "react";
import { formatLongDate, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { cx, EmptyState, Icon, SortHeader, toggleColumnSort } from "@/core/ui";
import { BulkImportModal } from "./BulkImportModal";
import { CardEditorModal } from "./CardEditorModal";
import { CardPreview } from "./CardPreview";
import { toAuthoredFeedCard } from "./feed-cards";
import { isSameCategory, MIND_CARD_TYPE_LABELS, type MindCard } from "./model";
import {
  type CardFilter,
  type CardSort,
  type CardSortColumn,
  computeStats,
  DEFAULT_CARD_SORT,
  listCategories,
  queryMindCards,
} from "./queries";
import { isScrollKeyEnabled } from "./store";

const FIELD =
  "w-full rounded-[12px] border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent";

const CHIP_BASE =
  "rounded-[10px] border px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
const CHIP_ON = "border-accent text-foreground";
const CHIP_OFF = "border-border text-muted hover:border-muted";

const FILTERS: { id: CardFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "learning", label: "Learning" },
  { id: "regular", label: "Regular" },
  { id: "hidden", label: "Hidden" },
];

const GRID_COLS = "grid-cols-[2rem_1fr_5.5rem_8rem_7rem_6rem_2.5rem]";

const SORT_COLUMNS: { column: CardSortColumn; label: string }[] = [
  { column: "title", label: "Name" },
  { column: "type", label: "Type" },
  { column: "category", label: "Category" },
  { column: "status", label: "Status" },
  { column: "addedAt", label: "Added" },
];

export function ScrollManagePage() {
  const mindCards = useStore((s) => s.mindCards);
  const mindMeta = useStore((s) => s.mindMeta);
  const vocabCount = useStore((s) => s.vocab.length);
  const setScrollToggle = useStore((s) => s.setScrollToggle);
  const renameMindCategory = useStore((s) => s.renameMindCategory);
  const hideMindCard = useStore((s) => s.hideMindCard);
  const restoreMindCard = useStore((s) => s.restoreMindCard);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CardFilter>("all");
  const [sort, setSort] = useState<CardSort>(DEFAULT_CARD_SORT);
  const [category, setCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorCardId, setEditorCardId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const rows = useMemo(
    () => queryMindCards(mindCards, { query, filter, sort, category }),
    [mindCards, query, filter, sort, category],
  );
  const categories = useMemo(() => listCategories(mindCards), [mindCards]);
  const stats = useMemo(() => computeStats(mindCards, todayISO()), [mindCards]);

  const isEmpty = mindCards.length === 0;
  const isHiddenView = filter === "hidden";

  const openEditor = (cardId: string | null) => {
    setEditorCardId(cardId);
    setIsEditorOpen(true);
  };
  const clearFilters = () => {
    setQuery("");
    setFilter("all");
    setCategory(null);
  };
  const handleSortColumn = (column: CardSortColumn) => {
    setSort((current) => toggleColumnSort(current, column, ["addedAt"]));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Cards</h1>
          <p className="mt-1 text-sm text-muted">
            Author, organize, and review the ideas your feed scrolls through.
          </p>
          <p className="mt-2 text-sm text-muted tabular-nums">
            {stats.cards} cards · {stats.learning} learning · {stats.dueToday} due today
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onPress={() => setIsImportOpen(true)}>
            <Icon name="upload" size={15} />
            Import
          </Button>
          <Button variant="primary" onPress={() => openEditor(null)}>
            <Icon name="plus" size={15} />
            New card
          </Button>
        </div>
      </header>

      {!isEmpty && (
        <>
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
                placeholder="Search cards…"
                aria-label="Search cards"
                className={FIELD}
              />
            </div>
            <fieldset className="flex flex-wrap gap-1.5" aria-label="Filter cards">
              {FILTERS.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={cx(CHIP_BASE, filter === f.id ? CHIP_ON : CHIP_OFF)}
                >
                  {f.label}
                </button>
              ))}
            </fieldset>
          </div>

          {categories.length > 0 && (
            <fieldset className="mt-3 flex flex-wrap gap-1.5" aria-label="Categories">
              {categories.map((label) => (
                <CategoryChip
                  key={label}
                  label={label}
                  isActive={category !== null && isSameCategory(category, label)}
                  isEnabled={isScrollKeyEnabled(mindMeta, "category", label)}
                  onFilter={() =>
                    setCategory((current) =>
                      current !== null && isSameCategory(current, label) ? null : label,
                    )
                  }
                  onToggle={(enabled) => setScrollToggle("category", label, enabled)}
                  onRename={(to) => renameMindCategory(label, to)}
                />
              ))}
            </fieldset>
          )}
        </>
      )}

      {isEmpty ? (
        <EmptyState
          title="No cards yet"
          body="Author an idea or paste a batch — your deck collects here."
          cta={
            <Button variant="primary" onPress={() => openEditor(null)}>
              New card
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No cards match"
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
            {rows.map((card) => (
              <li key={card.id}>
                <CardRow
                  card={card}
                  isExpanded={expandedId === card.id}
                  isHiddenView={isHiddenView}
                  onOpen={() => openEditor(card.id)}
                  onToggleExpand={() =>
                    setExpandedId((current) => (current === card.id ? null : card.id))
                  }
                  onHide={() => hideMindCard(card.id)}
                  onRestore={() => restoreMindCard(card.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <SourcesSection
        vocabCount={vocabCount}
        isEnabled={isScrollKeyEnabled(mindMeta, "source", "vocab")}
        onToggle={(enabled) => setScrollToggle("source", "vocab", enabled)}
      />

      <CardEditorModal
        cardId={editorCardId}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
      />
      <BulkImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}

function CategoryChip({
  label,
  isActive,
  isEnabled,
  onFilter,
  onToggle,
  onRename,
}: {
  label: string;
  isActive: boolean;
  isEnabled: boolean;
  onFilter: () => void;
  onToggle: (enabled: boolean) => void;
  onRename: (to: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(label);

  const commitRename = () => {
    const next = draft.trim();
    if (next && !isSameCategory(next, label)) onRename(next);
    setIsRenaming(false);
  };

  if (isRenaming) {
    return (
      <input
        type="text"
        aria-label={`Rename category ${label}`}
        value={draft}
        ref={(el) => {
          el?.focus();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename();
          if (e.key === "Escape") setIsRenaming(false);
        }}
        className="rounded-[10px] border border-accent bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    );
  }

  return (
    <span
      className={cx(
        "flex items-center gap-1 rounded-[10px] border pl-3 pr-1.5 py-0.5",
        isActive ? CHIP_ON : "border-border",
        isEnabled ? "" : "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onFilter}
        aria-pressed={isActive}
        className="text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={() => onToggle(!isEnabled)}
        aria-pressed={isEnabled}
        aria-label={isEnabled ? `Hide ${label} from feed` : `Show ${label} in feed`}
        className="rounded p-1 text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon name={isEnabled ? "eye" : "eye-off"} size={13} />
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft(label);
          setIsRenaming(true);
        }}
        aria-label={`Rename ${label}`}
        className="rounded p-1 text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon name="edit" size={13} />
      </button>
    </span>
  );
}

const EXCERPT_MAX = 60;

const buildCardLabel = (card: MindCard): string => {
  if (card.title.trim() !== "") return card.title;
  const excerpt = card.body
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (excerpt === "") return "Untitled";
  return excerpt.length > EXCERPT_MAX ? `${excerpt.slice(0, EXCERPT_MAX).trimEnd()}…` : excerpt;
};

function CardRow({
  card,
  isExpanded,
  isHiddenView,
  onOpen,
  onToggleExpand,
  onHide,
  onRestore,
}: {
  card: MindCard;
  isExpanded: boolean;
  isHiddenView: boolean;
  onOpen: () => void;
  onToggleExpand: () => void;
  onHide: () => void;
  onRestore: () => void;
}) {
  const mode = card.box !== null ? `learning · box ${card.box}` : "regular";
  const label = buildCardLabel(card);
  return (
    <div>
      <div className={cx("grid items-center gap-3 px-2 py-1.5", GRID_COLS)}>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={isExpanded ? `Collapse ${label}` : `Preview ${label}`}
          aria-expanded={isExpanded}
          className="justify-self-center rounded p-1.5 text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name={isExpanded ? "chevU" : "chevD"} size={14} />
        </button>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Edit ${label}`}
          className="truncate text-left text-sm font-medium text-foreground outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
        >
          {label}
        </button>
        <span className="truncate text-sm text-muted">{MIND_CARD_TYPE_LABELS[card.type]}</span>
        <span className="truncate text-sm text-muted">{card.category || "—"}</span>
        <span
          className={cx(
            "justify-self-start rounded-full px-2 py-0.5 text-xs",
            card.box !== null ? "bg-accent/10 text-accent" : "text-muted",
          )}
        >
          {mode}
        </span>
        <span className="text-xs text-muted tabular-nums">{formatLongDate(card.addedAt)}</span>
        <button
          type="button"
          onClick={isHiddenView ? onRestore : onHide}
          aria-label={isHiddenView ? `Restore ${label}` : `Hide ${label}`}
          className="justify-self-center rounded p-1.5 text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name={isHiddenView ? "eye" : "eye-off"} size={14} />
        </button>
      </div>
      {isExpanded && (
        <div className="border-t border-border bg-surface-secondary px-4 py-4">
          <CardPreview
            card={toAuthoredFeedCard(card, todayISO())}
            className="mx-auto max-w-[240px]"
          />
        </div>
      )}
    </div>
  );
}

function SourcesSection({
  vocabCount,
  isEnabled,
  onToggle,
}: {
  vocabCount: number;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-foreground">Sources</h2>
      <p className="mt-1 text-sm text-muted">
        Pull entries from elsewhere into the feed. The feed shows them read-only.
      </p>
      <div className="mt-3 flex items-center justify-between rounded-[16px] border border-border bg-surface px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Vocabulary</p>
          <p className="text-xs text-muted tabular-nums">{vocabCount} entries</p>
        </div>
        <Button
          size="sm"
          aria-pressed={isEnabled}
          variant={isEnabled ? "primary" : "outline"}
          onPress={() => onToggle(!isEnabled)}
        >
          <Icon name={isEnabled ? "eye" : "eye-off"} size={14} />
          {isEnabled ? "In feed" : "Hidden"}
        </Button>
      </div>
    </section>
  );
}
