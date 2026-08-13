import type { Card, CardTypeId } from "@vega/shared";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Button, ConfirmDialog, EmptyState, UndoBar } from "@/core/ui";
import {
  buildTypeChangeConfirmBody,
  buildTypeChangePatch,
  losesReviewOnTypeChange,
} from "../card-type-change";
import { type CardFilterState, EMPTY_CARD_FILTER } from "../manager-filter";
import {
  type CardSort,
  computeCardStats,
  DEFAULT_CARD_SORT,
  describeCardStats,
  queryCards,
} from "../manager-query";
import { listCardCategories } from "../queries";
import { useCardSelection } from "../useCardSelection";
import { useUndoBar } from "../useUndoBar";
import { CardsBulkBar } from "./CardsBulkBar";
import { CardsResults } from "./CardsResults";
import { CardsToolbar } from "./CardsToolbar";
import type { CardRowActions } from "./card-row-actions";
import { DeleteSelectionDialog } from "./DeleteSelectionDialog";
import { useCardsBulk } from "./useCardsBulk";

export function CardsPage() {
  const cards = useStore((s) => s.cards);
  const view = useStore((s) => s.cardPrefs.view);
  const ready = useStore((s) => s.ready);
  const loadFailed = useStore((s) => s.loadFailed);
  const setCardPrefs = useStore((s) => s.setCardPrefs);
  const updateCard = useStore((s) => s.updateCard);
  const hideCard = useStore((s) => s.hideCard);
  const bootstrap = useStore((s) => s.bootstrap);

  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CardFilterState>(EMPTY_CARD_FILTER);
  const [sort, setSort] = useState<CardSort>(DEFAULT_CARD_SORT);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pendingTypeChange, setPendingTypeChange] = useState<{
    card: Card;
    nextType: CardTypeId;
  } | null>(null);

  const today = todayISO();
  const rows = useMemo(
    () => queryCards(cards, { query, filter, sort, today }),
    [cards, query, filter, sort, today],
  );
  const categories = useMemo(() => listCardCategories(cards), [cards]);
  const stats = useMemo(() => computeCardStats(cards, today), [cards, today]);
  const visibleIds = useMemo(() => rows.map((card) => card.id), [rows]);

  const selection = useCardSelection(visibleIds);
  const undoBar = useUndoBar();
  const selectedIds = useMemo(() => [...selection.selectedIds], [selection.selectedIds]);
  const clearSelection = selection.clear;
  const onBulkDone = useCallback(() => clearSelection(), [clearSelection]);
  const bulk = useCardsBulk(selectedIds, today, undoBar, onBulkDone);
  const isDeckEmpty = cards.length === 0;

  const applyTypeChange = (card: Card, nextType: CardTypeId) =>
    updateCard(card.id, buildTypeChangePatch(card, nextType));

  const actions: CardRowActions = {
    onPatch: (id, patch) => updateCard(id, patch),
    onTypeChange: (card, nextType) => {
      if (nextType === card.type) return;
      if (losesReviewOnTypeChange(card, nextType)) setPendingTypeChange({ card, nextType });
      else applyTypeChange(card, nextType);
    },
    onToggleHidden: (card) =>
      card.hiddenAt === null ? hideCard(card.id) : updateCard(card.id, { hiddenAt: null }),
    onToggleSelect: selection.toggleOne,
    onOpen: (card) => navigate(`/cards/${card.id}`),
  };

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-semibold text-3xl text-foreground tracking-tight">Cards</h1>
        <p className="mt-1 text-muted text-sm tabular-nums">
          {isDeckEmpty ? "Nothing in the deck yet" : describeCardStats(stats, rows.length)}
        </p>
      </div>
      <Button solid icon="plus" onPress={() => navigate("/cards/new")}>
        New card
      </Button>
    </header>
  );

  if (loadFailed) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        {header}
        <EmptyState
          title="Couldn't load your cards"
          body="Nothing was lost — the deck just hasn't reached this screen yet."
          cta={
            <Button solid onPress={() => void bootstrap()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {header}

      {!isDeckEmpty && (
        <CardsToolbar
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          categories={categories}
          visibleCount={rows.length}
          totalCount={stats.total}
          view={view}
          onViewChange={(next) => setCardPrefs({ view: next })}
        />
      )}

      {selectedIds.length > 0 && (
        <CardsBulkBar
          selectedCount={selectedIds.length}
          categories={categories}
          onSetCategory={bulk.setCategory}
          onSetLearning={bulk.setLearning}
          onHide={bulk.hide}
          onDelete={() => setIsDeleteOpen(true)}
          onClear={selection.clear}
        />
      )}

      {bulk.failure !== null && (
        <div className="mt-3 flex items-center gap-3 rounded-[12px] border border-danger/40 bg-surface px-4 py-2.5">
          <span className="text-danger text-sm tabular-nums">
            {`${bulk.failure.failedCount} of ${bulk.failure.totalCount} couldn’t be saved`}
          </span>
          <Button onPress={bulk.failure.retry}>Retry those</Button>
        </div>
      )}

      {bulk.notice !== null && (
        <p
          role="status"
          className="mt-3 rounded-[12px] border border-border bg-surface px-4 py-2.5 text-muted text-sm tabular-nums"
        >
          {bulk.notice}
        </p>
      )}

      <CardsResults
        rows={rows}
        categories={categories}
        isReady={ready}
        isDeckEmpty={isDeckEmpty}
        view={view}
        sort={sort}
        onSortChange={setSort}
        selection={selection}
        actions={actions}
        onNewCard={() => navigate("/cards/new")}
        onClearFilters={() => {
          setQuery("");
          setFilter(EMPTY_CARD_FILTER);
        }}
      />

      <DeleteSelectionDialog
        count={selectedIds.length}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => {
          setIsDeleteOpen(false);
          bulk.remove();
        }}
      />

      <ConfirmDialog
        open={pendingTypeChange !== null}
        title="Change type?"
        body={
          pendingTypeChange === null ? "" : buildTypeChangeConfirmBody(pendingTypeChange.nextType)
        }
        confirmLabel="Change type"
        onConfirm={() => {
          if (pendingTypeChange !== null) {
            applyTypeChange(pendingTypeChange.card, pendingTypeChange.nextType);
          }
          setPendingTypeChange(null);
        }}
        onClose={() => setPendingTypeChange(null)}
      />

      {undoBar.pending !== null && (
        <UndoBar tone="ink" message={undoBar.pending.message} onUndo={undoBar.undo} />
      )}
    </div>
  );
}
