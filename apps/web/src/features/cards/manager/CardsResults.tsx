import type { Card } from "@vega/shared";
import { Button, EmptyState, toggleColumnSort } from "@/core/ui";
import type { CardSort, CardSortColumn } from "../manager-query";
import type { CardSelection } from "../useCardSelection";
import { CardsGallery } from "./CardsGallery";
import { CardsMobileList } from "./CardsMobileList";
import { CardsTable } from "./CardsTable";
import { CardsTableSkeleton } from "./CardsTableSkeleton";
import type { CardRowActions } from "./card-row-actions";

export interface CardsResultsProps {
  rows: Card[];
  categories: string[];
  isReady: boolean;
  isDeckEmpty: boolean;
  view: "rows" | "gallery";
  sort: CardSort;
  onSortChange: (next: (current: CardSort) => CardSort) => void;
  selection: CardSelection;
  actions: CardRowActions;
  onNewCard: () => void;
  onClearFilters: () => void;
}

/** Whichever of the six list states is live — the page itself never branches on them. */
export function CardsResults({
  rows,
  categories,
  isReady,
  isDeckEmpty,
  view,
  sort,
  onSortChange,
  selection,
  actions,
  onNewCard,
  onClearFilters,
}: CardsResultsProps) {
  if (!isReady) return <CardsTableSkeleton />;

  if (isDeckEmpty) {
    return (
      <EmptyState
        title="Write your first card"
        body="A card is one idea you want to meet again. The feed will bring it back."
        cta={
          <Button solid icon="plus" onPress={onNewCard}>
            New card
          </Button>
        }
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing matches those filters"
        body="The deck still holds every card — this search and these filters just leave none of them showing."
        cta={<Button onPress={onClearFilters}>Clear filters</Button>}
      />
    );
  }

  if (view === "gallery") return <CardsGallery rows={rows} selectedIds={selection.selectedIds} />;

  return (
    <>
      <div className="hidden sm:block">
        <CardsTable
          rows={rows}
          categories={categories}
          selectedIds={selection.selectedIds}
          isAllVisibleSelected={selection.isAllVisibleSelected}
          sort={sort}
          onSort={(column: CardSortColumn) =>
            onSortChange((current) => toggleColumnSort(current, column, ["addedAt"]))
          }
          onToggleVisible={selection.toggleVisible}
          actions={actions}
        />
      </div>
      <div className="sm:hidden">
        <CardsMobileList
          rows={rows}
          categories={categories}
          selectedIds={selection.selectedIds}
          actions={actions}
          onLongPressSelect={selection.select}
        />
      </div>
    </>
  );
}
