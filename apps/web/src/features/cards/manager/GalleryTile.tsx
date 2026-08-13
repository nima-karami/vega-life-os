import { type Card, hasReveal } from "@vega/shared";
import { useState } from "react";
import { cx } from "@/core/ui";
import { CardFace } from "../face/CardFace";
import { composeFace, type FaceSide } from "../face/compose";
import { GALLERY_SCALE } from "./CardsGallery";

export function GalleryTile({ card, isSelected }: { card: Card; isSelected: boolean }) {
  const [side, setSide] = useState<FaceSide>("face");
  const canTurn = hasReveal(card);
  const shell = cx(
    "relative aspect-[390/600] overflow-hidden rounded-[13px] border bg-surface shadow-soft",
    isSelected ? "border-accent" : "border-border",
  );
  const face = (
    <span className="absolute inset-0 block">
      <CardFace spec={composeFace(card, side)} scale={GALLERY_SCALE} />
    </span>
  );

  if (!canTurn) {
    return (
      <figure className={shell} aria-label={`${card.title} — face`}>
        {face}
      </figure>
    );
  }

  return (
    <button
      type="button"
      className={cx(shell, "outline-none focus-visible:ring-2 focus-visible:ring-accent")}
      aria-label={`${card.title} — ${side === "face" ? "face" : "reveal"}`}
      onClick={() => setSide((current) => (current === "face" ? "reveal" : "face"))}
    >
      {face}
    </button>
  );
}
