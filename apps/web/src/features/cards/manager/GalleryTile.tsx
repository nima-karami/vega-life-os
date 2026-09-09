import { type Card, hasReveal } from "@vega/shared";
import { useReducedMotion } from "framer-motion";
import { useState } from "react";
import { ContextMenu, cx } from "@/core/ui";
import { CardFace } from "../face/CardFace";
import { CardFlip } from "../face/CardFlip";
import { composeFace, type FaceSide } from "../face/compose";
import { buildCardMenuItems, type CardRowActions } from "./card-row-actions";
import { CARD_STAGE_WIDTH_PX, deriveGalleryScale } from "./gallery-scale";

/** The container holds the tile's place in the grid; the card inside it is what turns. */
const SLOT = "relative aspect-[390/600]";
const CARD_CHROME = "rounded-[13px] border shadow-soft";
// CardFlip paints that border on each face, so the face is laid out inside it, not across it.
const CARD_CHROME_BORDER_PX = 1;

export function GalleryTile({
  card,
  isSelected,
  actions,
  tileWidthPx,
}: {
  card: Card;
  isSelected: boolean;
  actions: CardRowActions;
  tileWidthPx: number;
}) {
  const [isTurned, setIsTurned] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const canTurn = hasReveal(card);
  const menuItems = buildCardMenuItems(card, actions, { isSelected });
  const scale = deriveGalleryScale(tileWidthPx - 2 * CARD_CHROME_BORDER_PX);
  const faceSide = (side: FaceSide) =>
    scale > 0 ? (
      <CardFace spec={composeFace(card, side)} scale={scale} columnWidthPx={CARD_STAGE_WIDTH_PX} />
    ) : null;
  const face = (
    <CardFlip
      turned={isTurned}
      reduceMotion={shouldReduceMotion === true}
      faceClass={cx(CARD_CHROME, isSelected ? "border-accent" : "border-border")}
      front={faceSide("face")}
      back={canTurn ? faceSide("reveal") : null}
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
