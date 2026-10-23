import type { Card } from "@vega/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cx, useBelowLarge, useCompact } from "@/core/ui";
import type { CardRowActions } from "./card-row-actions";
import { GalleryTile } from "./GalleryTile";
import { useCardsVirtualizer } from "./useCardsVirtualizer";
import { chunkIntoRows, deriveGalleryColumns, estimateGalleryRowPx } from "./virtual-window";
import { WindowSlot } from "./WindowSlot";

const GAP_PX = 16;
const OVERSCAN_ROWS = 1;

// Every track is 1fr and the resolved template has the gaps taken out, so one read of a row's
// first track sizes every tile — not an observer per tile. A row still laid out for another
// column count falls back to dividing the list.
function readTrackWidth(list: HTMLElement, columns: number): number {
  const row = list.querySelector<HTMLElement>("[data-index]");
  const tracks = row === null ? [] : window.getComputedStyle(row).gridTemplateColumns.split(" ");
  const track = Number.parseFloat(tracks[0] ?? "");
  if (tracks.length === columns && Number.isFinite(track)) return track;
  return Math.max(0, (list.getBoundingClientRect().width - (columns - 1) * GAP_PX) / columns);
}

export function CardsGallery({
  rows,
  selectedIds,
  actions,
}: {
  rows: Card[];
  selectedIds: Set<string>;
  actions: CardRowActions;
}) {
  const columns = deriveGalleryColumns({ isCompact: useCompact(), isBelowLarge: useBelowLarge() });
  const tileRows = useMemo(() => chunkIntoRows(rows, columns), [rows, columns]);
  const [tileWidthPx, setTileWidthPx] = useState(0);

  const estimateSize = useCallback(() => estimateGalleryRowPx(tileWidthPx, GAP_PX), [tileWidthPx]);
  const { virtualizer, listRef, slots, spacers } = useCardsVirtualizer({
    listKey: "gallery",
    rows: tileRows,
    estimateSize,
    overscan: OVERSCAN_ROWS,
  });

  useEffect(() => {
    const grid = listRef.current;
    if (grid === null) return;
    const observer = new ResizeObserver(() => setTileWidthPx(readTrackWidth(grid, columns)));
    observer.observe(grid);
    return () => observer.disconnect();
  }, [listRef, columns]);

  return (
    <div
      ref={listRef}
      className="mt-4"
      style={{ paddingTop: spacers.before, paddingBottom: spacers.after }}
    >
      {slots.map(({ key, index, row: tiles, gapPx }) => (
        <WindowSlot key={key} gapPx={gapPx}>
          <div
            ref={virtualizer.measureElement}
            data-index={index}
            className={cx("grid gap-4", index < tileRows.length - 1 && "pb-4")}
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {tiles.map((card) => (
              <GalleryTile
                key={card.id}
                card={card}
                isSelected={selectedIds.has(card.id)}
                actions={actions}
                tileWidthPx={tileWidthPx}
              />
            ))}
          </div>
        </WindowSlot>
      ))}
    </div>
  );
}
