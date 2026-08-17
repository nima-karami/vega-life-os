import { Button } from "@heroui/react";
import { cx } from "@/core/ui";
import { FeedHeaderGlyphs } from "./FeedHeaderGlyphs";
import { FaceHeaderRow } from "./face/CardFace";
import { FACE_HEADER } from "./face/face-metrics";
import { BARE_CONTROL } from "./feed-chrome";
import type { FeedHeaderGlyph } from "./feed-pool";

/**
 * The header the reader sees is drawn on the card's faces, so it turns with the card. This
 * is only its tap target: an invisible copy of the same row, aligned over the drawn one.
 */
export function FeedHeaderControl({
  typeLabel,
  category,
  glyphs,
  onOpen,
}: {
  typeLabel: string;
  category: string;
  glyphs: FeedHeaderGlyph[];
  onOpen: () => void;
}) {
  return (
    <Button
      aria-label="What you see"
      variant="ghost"
      onPress={onOpen}
      className={cx(
        BARE_CONTROL,
        "pointer-events-auto block w-full focus-visible:ring-2 focus-visible:ring-accent",
      )}
    >
      <span className="invisible block" aria-hidden>
        <FaceHeaderRow
          typeLabel={typeLabel}
          category={category}
          leading={<FeedHeaderGlyphs glyphs={glyphs} />}
          fontSize={FACE_HEADER.size}
          tracking={FACE_HEADER.tracking}
          gap={FACE_HEADER.gap}
        />
      </span>
    </Button>
  );
}
