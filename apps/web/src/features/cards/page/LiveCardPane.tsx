import type { Card } from "@vega/shared";
import { TurnableCard } from "../face/TurnableCard";

/**
 * The aside reserves the card's spot and the card turns inside it — the border, radius and
 * shadow ride on the rotating faces, so what flips is the card and not just its contents.
 * `position:sticky` is also what gives the pinned faces their containing block.
 */
export function LiveCardPane({ card }: { card: Card }) {
  return (
    <aside className="sticky top-5 hidden shrink-0 sm:block">
      <div data-testid="live-card" className="relative h-[600px] w-[390px]">
        <TurnableCard
          card={card}
          scale={1}
          faceClass="rounded-[24px] border border-border shadow-soft"
        />
      </div>
    </aside>
  );
}
