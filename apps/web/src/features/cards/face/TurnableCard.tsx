import { type Card, hasReveal, type SlotId } from "@vega/shared";
import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { CardFace } from "./CardFace";
import { CardFlip } from "./CardFlip";
import { composeFace } from "./compose";

/** Clicking turns the card over and back — the same gesture and the same motion as the feed. */
export function TurnableCard({
  card,
  scale,
  faceClass,
  sampleSlots,
}: {
  card: Card;
  scale: number;
  /** the card chrome, carried onto both faces so the card itself is what rotates */
  faceClass?: string;
  sampleSlots?: ReadonlySet<SlotId>;
}) {
  const [isTurned, setIsTurned] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const canTurn = hasReveal(card);

  useEffect(() => {
    if (!canTurn) setIsTurned(false);
  }, [canTurn]);

  const body = (
    <CardFlip
      turned={isTurned}
      reduceMotion={shouldReduceMotion === true}
      faceClass={faceClass}
      front={<CardFace spec={composeFace(card, "face", sampleSlots)} scale={scale} />}
      back={
        canTurn ? <CardFace spec={composeFace(card, "reveal", sampleSlots)} scale={scale} /> : null
      }
    />
  );

  if (!canTurn) return <span className="absolute inset-0 block">{body}</span>;

  return (
    <button
      type="button"
      aria-label={isTurned ? "Card, showing the reveal" : "Card, showing the front"}
      onClick={() => setIsTurned((current) => !current)}
      className="absolute inset-0 block text-left"
    >
      {body}
    </button>
  );
}
