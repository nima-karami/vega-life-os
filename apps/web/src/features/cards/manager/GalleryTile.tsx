import { type Card, hasReveal } from "@vega/shared";
import { useReducedMotion } from "framer-motion";
import { useState } from "react";
import { cx } from "@/core/ui";
import { CardFace } from "../face/CardFace";
import { CardFlip } from "../face/CardFlip";
import { composeFace } from "../face/compose";
import { GALLERY_SCALE } from "./CardsGallery";

export function GalleryTile({ card, isSelected }: { card: Card; isSelected: boolean }) {
  const [isTurned, setIsTurned] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const canTurn = hasReveal(card);
  const shell = cx(
    "relative aspect-[390/600] overflow-hidden rounded-[13px] border shadow-soft",
    isSelected ? "border-accent" : "border-border",
  );
  const face = (
    <CardFlip
      turned={isTurned}
      reduceMotion={shouldReduceMotion === true}
      front={<CardFace spec={composeFace(card, "face")} scale={GALLERY_SCALE} />}
      back={canTurn ? <CardFace spec={composeFace(card, "reveal")} scale={GALLERY_SCALE} /> : null}
    />
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
      aria-label={`${card.title} — ${isTurned ? "reveal" : "face"}`}
      onClick={() => setIsTurned((current) => !current)}
    >
      {face}
    </button>
  );
}
