import type { Card } from "@vega/shared";
import type { CardRowActions } from "./card-row-actions";
import { GalleryTile } from "./GalleryTile";

/** Per-property scale, not a CSS transform — CardFace multiplies each size and floors small text. */
export const GALLERY_SCALE = 0.54;

export function CardsGallery({
  rows,
  selectedIds,
  actions,
}: {
  rows: Card[];
  selectedIds: Set<string>;
  actions: CardRowActions;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((card) => (
        <GalleryTile
          key={card.id}
          card={card}
          isSelected={selectedIds.has(card.id)}
          actions={actions}
        />
      ))}
    </div>
  );
}
