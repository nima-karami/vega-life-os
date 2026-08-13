import { type Card, hasReveal } from "@vega/shared";
import { useEffect, useState } from "react";
import { cx } from "@/core/ui";
import { CardFace } from "./CardFace";
import { TURN_MS } from "./CardTurn";
import { composeFace, type FaceSide } from "./compose";

/** Two pinned layers cross-fading with a blur — the drawn turn is never a flip. */
export function TurnableCard({ card, scale }: { card: Card; scale: number }) {
  const [side, setSide] = useState<FaceSide>("face");
  const canTurn = hasReveal(card);

  useEffect(() => {
    if (!canTurn) setSide("face");
  }, [canTurn]);

  const body = (["face", "reveal"] as const).map((layer) => (
    <span
      key={layer}
      aria-hidden={layer !== side}
      className={cx(
        "absolute inset-0 block transition-[opacity,filter] motion-reduce:transition-none",
        layer === "reveal" ? "bg-surface-secondary" : "bg-surface",
        layer === side ? "opacity-100 blur-0" : "pointer-events-none opacity-0 blur-[3px]",
      )}
      style={{ transitionDuration: `${TURN_MS}ms` }}
    >
      <CardFace spec={composeFace(card, layer)} scale={scale} />
    </span>
  ));

  if (!canTurn) return <span className="absolute inset-0 block bg-surface">{body}</span>;
  return (
    <button
      type="button"
      aria-label={side === "face" ? "Card, showing the front" : "Card, showing the reveal"}
      onClick={() => setSide(side === "face" ? "reveal" : "face")}
      className="absolute inset-0 block text-left"
    >
      {body}
    </button>
  );
}
