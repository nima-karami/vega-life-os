import { Button, ButtonGroup, Modal, useOverlayState } from "@heroui/react";
import { useState } from "react";
import { cx, Icon, Popover, useCompact, useCompactModal } from "@/core/ui";
import { type CardFilterState, countCheckedFilters } from "../manager-filter";
import { CardsFilterPanel } from "./CardsFilterPanel";

export interface CardsToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: CardFilterState;
  onFilterChange: (next: CardFilterState) => void;
  categories: string[];
  visibleCount: number;
  totalCount: number;
  view: "rows" | "gallery";
  onViewChange: (view: "rows" | "gallery") => void;
}

const SEARCH_CLASS =
  "h-11 w-full rounded-[12px] border border-border bg-surface py-2 pr-3 pl-9 text-foreground text-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent sm:h-9";

export function CardsToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  categories,
  visibleCount,
  totalCount,
  view,
  onViewChange,
}: CardsToolbarProps) {
  const isCompact = useCompact();
  const responsive = useCompactModal("sm");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const modalState = useOverlayState({ isOpen: isFilterOpen, onOpenChange: setIsFilterOpen });
  const appliedCount = countCheckedFilters(filter);
  const isFiltered = appliedCount > 0;

  const panel = (
    <CardsFilterPanel
      filter={filter}
      onFilterChange={onFilterChange}
      categories={categories}
      visibleCount={visibleCount}
      totalCount={totalCount}
    />
  );

  const filterTrigger = (
    <>
      <Icon
        name="sliders"
        size={isCompact ? 16 : 15}
        className={isFiltered ? "text-accent" : "text-muted"}
      />
      {!isCompact && "Filter"}
      {!isCompact && isFiltered && (
        <span className="grid h-[18px] min-w-[18px] place-items-center rounded-[9px] bg-accent px-1.5 font-medium text-[11px] text-white tabular-nums">
          {appliedCount}
        </span>
      )}
    </>
  );

  return (
    <div className="mt-5 flex items-center gap-2 sm:gap-3">
      <div className="relative min-w-0 flex-1">
        <Icon
          name="search"
          size={16}
          className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 text-muted"
        />
        <input
          type="search"
          value={query}
          aria-label="Search cards"
          placeholder="Search cards…"
          onChange={(event) => onQueryChange(event.target.value)}
          className={SEARCH_CLASS}
        />
      </div>

      {isCompact ? (
        <>
          <button
            type="button"
            aria-label="Filter cards"
            aria-expanded={isFilterOpen}
            onClick={() => setIsFilterOpen(true)}
            className={cx(
              "grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border bg-surface",
              isFiltered ? "border-accent" : "border-border",
            )}
          >
            {filterTrigger}
          </button>
          <Modal state={modalState}>
            <Modal.Backdrop variant="blur">
              <Modal.Container {...responsive}>
                <Modal.Dialog>
                  <Modal.Header>
                    <Modal.Heading className="font-semibold text-lg tracking-tight">
                      Filter cards
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>{panel}</Modal.Body>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
        </>
      ) : (
        <Popover
          open={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          align="end"
          triggerLabel="Filter cards"
          className="p-[5px]"
          triggerClassName={cx(
            "inline-flex h-9 shrink-0 items-center gap-[7px] rounded-[12px] border bg-surface px-3 font-medium text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent",
            isFiltered ? "border-accent text-foreground" : "border-border text-muted",
          )}
          triggerContent={filterTrigger}
        >
          {panel}
        </Popover>
      )}

      <ButtonGroup aria-label="Card view" className="shrink-0">
        <Button
          isIconOnly
          size="sm"
          aria-label="Table view"
          aria-pressed={view === "rows"}
          variant={view === "rows" ? "primary" : "secondary"}
          onPress={() => onViewChange("rows")}
        >
          <Icon name="rows" size={15} />
        </Button>
        <Button
          isIconOnly
          size="sm"
          aria-label="Gallery view"
          aria-pressed={view === "gallery"}
          variant={view === "gallery" ? "primary" : "secondary"}
          onPress={() => onViewChange("gallery")}
        >
          <Icon name="grid" size={15} />
        </Button>
      </ButtonGroup>
    </div>
  );
}
