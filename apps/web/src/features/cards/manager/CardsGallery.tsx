import type { Card } from "@vega/shared";
import { GalleryTile } from "./GalleryTile";

/** Per-property scale, not a CSS transform — CardFace multiplies each size and floors small text. */
export const GALLERY_SCALE = 0.54;

export function CardsGallery({ rows, selectedIds }: { rows: Card[]; selectedIds: Set<string> }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((card) => (
        <GalleryTile key={card.id} card={card} isSelected={selectedIds.has(card.id)} />
      ))}
    </div>
  );
}
