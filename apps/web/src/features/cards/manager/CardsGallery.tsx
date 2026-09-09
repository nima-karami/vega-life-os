import type { Card } from "@vega/shared";
import { useEffect, useRef, useState } from "react";
import { GalleryTile } from "./GalleryTile";
import type { CardRowActions } from "./card-row-actions";

const GRID_CLASS = "mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5";

// The resolved template already has the gaps taken out — one read, not an observer per tile.
function readTrackWidth(grid: HTMLElement): number {
  const track = Number.parseFloat(window.getComputedStyle(grid).gridTemplateColumns);
  return Number.isFinite(track) ? track : 0;
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
  const gridRef = useRef<HTMLDivElement>(null);
  const [tileWidthPx, setTileWidthPx] = useState(0);

  useEffect(() => {
    const grid = gridRef.current;
    if (grid === null) return;
    const observer = new ResizeObserver(() => setTileWidthPx(readTrackWidth(grid)));
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={gridRef} className={GRID_CLASS}>
      {rows.map((card) => (
        <GalleryTile
          key={card.id}
          card={card}
          isSelected={selectedIds.has(card.id)}
          actions={actions}
          tileWidthPx={tileWidthPx}
        />
      ))}
    </div>
  );
}
