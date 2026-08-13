import type { Card } from "@vega/shared";
import { TurnableCard } from "../face/TurnableCard";

/** `position:sticky` is also what gives the pinned face layers their containing block. */
export function LiveCardPane({ card }: { card: Card }) {
  return (
    <aside className="sticky top-5 hidden shrink-0 sm:block">
      <div
        data-testid="live-card"
        className="relative h-[600px] w-[390px] overflow-hidden rounded-[24px] border border-border bg-surface shadow-soft"
      >
        <TurnableCard card={card} scale={1} />
      </div>
    </aside>
  );
}
