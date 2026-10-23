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

// One read of the resolved first track sizes every tile, not an observer per tile.
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
  // Held here, not in the tile, so a turned card stays turned when it scrolls out and back.
  const [turnedIds, setTurnedIds] = useState<ReadonlySet<string>>(() => new Set());

  const toggleTurn = useCallback((id: string) => {
    setTurnedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const estimateSize = useCallback(() => estimateGalleryRowPx(tileWidthPx, GAP_PX), [tileWidthPx]);
  const getItemKey = useCallback((index: number) => `${columns}:${index}`, [columns]);
  const { virtualizer, listRef, slots, spacers } = useCardsVirtualizer({
    listKey: "gallery",
    rows: tileRows,
    estimateSize,
    overscan: OVERSCAN_ROWS,
    getItemKey,
  });

  useEffect(() => {
    const grid = listRef.current;
    if (grid === null) return;
    const observer = new ResizeObserver(() => setTileWidthPx(readTrackWidth(grid, columns)));
    observer.observe(grid);
    return () => observer.disconnect();
  }, [listRef, columns]);

  useEffect(() => {
    if (tileWidthPx > 0) virtualizer.measure();
  }, [virtualizer, tileWidthPx]);

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
                isTurned={turnedIds.has(card.id)}
                onToggleTurn={toggleTurn}
              />
            ))}
          </div>
        </WindowSlot>
      ))}
    </div>
  );
}
