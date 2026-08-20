import type { Card } from "@vega/shared";
import { Icon } from "@/core/ui";

export type BrainWriteBadgeState =
  | { kind: "hidden" }
  | { kind: "active"; box: number }
  | { kind: "cleared" };

export function deriveBrainWriteBadgeState(
  card: Pick<Card, "box">,
  clearedToday: boolean,
): BrainWriteBadgeState {
  if (card.box === null) return { kind: "hidden" };
  if (clearedToday) return { kind: "cleared" };
  return { kind: "active", box: card.box };
}

// The header row is a fixed 18px, so the glyph matches FeedHeaderGlyphs' own size.
const BADGE_GLYPH_PX = 13;

export function BrainWriteBadge({ state }: { state: BrainWriteBadgeState }) {
  if (state.kind === "hidden") return null;
  if (state.kind === "cleared") {
    return (
      <span aria-hidden className="inline-flex items-center gap-0.5 text-ink/30">
        <Icon name="brain" size={BADGE_GLYPH_PX} />
        <Icon name="check" size={BADGE_GLYPH_PX} />
      </span>
    );
  }
  return (
    <span aria-hidden className="inline-flex items-center gap-1 text-accent">
      <Icon name="brain" size={BADGE_GLYPH_PX} />
      <span className="font-mono text-[9.5px] tracking-[.06em]">{state.box}</span>
    </span>
  );
}
