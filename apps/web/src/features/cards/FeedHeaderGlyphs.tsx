import type { IconName } from "@/core/lib/icon-names";
import { Icon } from "@/core/ui";
import type { FeedHeaderGlyph } from "./feed-pool";

const HEADER_GLYPH_PX = 13;

const HEADER_GLYPH_ICON: Record<FeedHeaderGlyph, IconName> = {
  mode: "book",
  filter: "filter",
};

export function FeedHeaderGlyphs({ glyphs }: { glyphs: FeedHeaderGlyph[] }) {
  if (glyphs.length === 0) return null;
  return (
    <span
      data-feed-glyphs={glyphs.join(" ")}
      className="inline-flex items-center gap-1.5 text-accent"
    >
      {glyphs.map((glyph) => (
        <Icon key={glyph} name={HEADER_GLYPH_ICON[glyph]} size={HEADER_GLYPH_PX} />
      ))}
    </span>
  );
}
