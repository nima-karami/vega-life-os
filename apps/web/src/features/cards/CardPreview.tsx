import { useLayoutEffect, useRef, useState } from "react";
import { cx } from "@/core/ui";
import { CardBack, CardFront, SingleFaceCard } from "./CardFaces";
import type { FeedCard } from "./feed-cards";

// The faces are sized for a phone-sized feed viewport; the preview renders them at that
// size and scales the whole stage down, so proportions stay true instead of reflowing.
const STAGE_WIDTH = 380;
const STAGE_HEIGHT = 680;

const FRAME_CLASS =
  "relative block w-full overflow-hidden rounded-[16px] border border-border bg-background";

export function CardPreview({ card, className }: { card: FeedCard; className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const canFlip = card.hasReveal && card.body !== "";
  const showBack = canFlip && isFlipped;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fitToWidth = (width: number) => setScale(width / STAGE_WIDTH);
    fitToWidth(frame.clientWidth);
    const observer = new ResizeObserver(([entry]) => fitToWidth(entry.contentRect.width));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const stage = (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 origin-top-left"
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}
    >
      {!card.hasReveal && <SingleFaceCard card={card} />}
      {card.hasReveal && (showBack ? <CardBack body={card.body} /> : <CardFront card={card} />)}
    </div>
  );

  return (
    <div
      ref={frameRef}
      data-card-preview
      className={cx(FRAME_CLASS, className)}
      style={{ aspectRatio: `${STAGE_WIDTH} / ${STAGE_HEIGHT}` }}
    >
      {stage}
      {canFlip && (
        <button
          type="button"
          aria-pressed={isFlipped}
          aria-label={showBack ? "Show the front of the card" : "Show the back of the card"}
          onClick={() => setIsFlipped((current) => !current)}
          className="absolute inset-0 flex items-end justify-end p-3 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="rounded-full border border-border bg-surface/80 px-2.5 py-1 text-xs text-muted backdrop-blur">
            {showBack ? "Back" : "Front"} · tap to flip
          </span>
        </button>
      )}
    </div>
  );
}
