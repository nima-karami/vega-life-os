import { Button } from "@heroui/react";
import type { IconName } from "@/core/lib/icon-names";
import { cx, Icon } from "@/core/ui";
import { FaceHeaderRow } from "./face/CardFace";
import { FACE_HEADER } from "./face/face-metrics";
import { BARE_CONTROL } from "./feed-chrome";
import type { FeedHeaderGlyph } from "./feed-pool";

const HEADER_GLYPH_PX = 13;

const HEADER_GLYPH_ICON: Record<FeedHeaderGlyph, IconName> = {
  mode: "book",
  filter: "filter",
};

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
  const leading =
    glyphs.length === 0 ? null : (
      <span
        data-feed-glyphs={glyphs.join(" ")}
        className="inline-flex items-center gap-1.5 text-accent"
      >
        {glyphs.map((glyph) => (
          <Icon key={glyph} name={HEADER_GLYPH_ICON[glyph]} size={HEADER_GLYPH_PX} />
        ))}
      </span>
    );

  return (
    <Button
      aria-label="What you see"
      variant="ghost"
      onPress={onOpen}
      className={cx(
        BARE_CONTROL,
        "group pointer-events-auto block w-full focus-visible:ring-2 focus-visible:ring-accent",
      )}
    >
      <FaceHeaderRow
        typeLabel={typeLabel}
        category={category}
        leading={leading}
        fontSize={FACE_HEADER.size}
        tracking={FACE_HEADER.tracking}
        gap={FACE_HEADER.gap}
        pressable
      />
    </Button>
  );
}
