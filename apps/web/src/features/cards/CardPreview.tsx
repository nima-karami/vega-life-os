import { type Card, hasReveal } from "@vega/shared";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/core/ui";
import { CardTurn } from "./face/CardTurn";
import { composeFace } from "./face/compose";

const CARD_WIDTH = 390;
const CARD_HEIGHT = 600;

const FRAME_CLASS =
  "relative block w-full overflow-hidden rounded-[24px] border border-border shadow-soft";

export function CardPreview({ card, className }: { card: Card; className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [isTurned, setIsTurned] = useState(false);
  const face = useMemo(() => composeFace(card, "face"), [card]);
  const reveal = useMemo(() => (hasReveal(card) ? composeFace(card, "reveal") : null), [card]);
  const canTurn = reveal !== null;
  const showsReveal = canTurn && isTurned;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    const fitToWidth = (width: number) => setScale(width / CARD_WIDTH);
    fitToWidth(frame.clientWidth);
    const observer = new ResizeObserver(([entry]) => fitToWidth(entry.contentRect.width));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      data-card-preview
      className={cx(FRAME_CLASS, className)}
      style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
    >
      {scale > 0 && <CardTurn face={face} reveal={reveal} turned={showsReveal} scale={scale} />}
      {canTurn && (
        <button
          type="button"
          aria-pressed={isTurned}
          aria-label={showsReveal ? "Show the front of the card" : "Show the back of the card"}
          onClick={() => setIsTurned((current) => !current)}
          className="absolute inset-0 flex items-end justify-end p-3 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="rounded-full border border-border bg-surface/80 px-2.5 py-1 text-muted text-xs backdrop-blur">
            {showsReveal ? "Back" : "Front"} · tap to turn
          </span>
        </button>
      )}
    </div>
  );
}
