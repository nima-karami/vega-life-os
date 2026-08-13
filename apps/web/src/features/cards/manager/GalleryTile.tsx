import { type Card, hasReveal } from "@vega/shared";
import { useReducedMotion } from "framer-motion";
import { useState } from "react";
import { ContextMenu, cx } from "@/core/ui";
import { CardFace } from "../face/CardFace";
import { CardFlip } from "../face/CardFlip";
import { composeFace } from "../face/compose";
import { buildCardMenuItems, type CardRowActions } from "./card-row-actions";
import { GALLERY_SCALE } from "./CardsGallery";

/** The container holds the tile's place in the grid; the card inside it is what turns. */
const SLOT = "relative aspect-[390/600]";
const CARD_CHROME = "rounded-[13px] border shadow-soft";

export function GalleryTile({
  card,
  isSelected,
  actions,
}: {
  card: Card;
  isSelected: boolean;
  actions: CardRowActions;
}) {
  const [isTurned, setIsTurned] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const canTurn = hasReveal(card);
  const menuItems = buildCardMenuItems(card, actions, { isSelected });
  const face = (
    <CardFlip
      turned={isTurned}
      reduceMotion={shouldReduceMotion === true}
      faceClass={cx(CARD_CHROME, isSelected ? "border-accent" : "border-border")}
      front={<CardFace spec={composeFace(card, "face")} scale={GALLERY_SCALE} />}
      back={canTurn ? <CardFace spec={composeFace(card, "reveal")} scale={GALLERY_SCALE} /> : null}
    />
  );

  if (!canTurn) {
    return (
      <ContextMenu items={menuItems} longPress>
        <figure className={SLOT} aria-label={`${card.title} — face`}>
          {face}
        </figure>
      </ContextMenu>
    );
  }

  return (
    <ContextMenu items={menuItems} longPress>
      <button
        type="button"
        className={cx(
          SLOT,
          "rounded-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent",
        )}
        aria-label={`${card.title} — ${isTurned ? "reveal" : "face"}`}
        onClick={() => setIsTurned((current) => !current)}
      >
        {face}
      </button>
    </ContextMenu>
  );
}
