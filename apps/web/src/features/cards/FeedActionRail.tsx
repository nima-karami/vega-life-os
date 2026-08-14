import { Button } from "@heroui/react";
import { type Card, feedStep } from "@vega/shared";
import { getIconStateStyle, Icon, type IconState } from "@/core/ui";
import { FULL_BLEED_PADDING } from "./face/face-metrics";

const RAIL_TARGET =
  "grid h-11 w-11 place-items-center rounded-none bg-transparent p-0 shadow-none data-[hovered=true]:bg-transparent focus-visible:ring-2 focus-visible:ring-accent";
const RAIL_GLYPH_PX = 20;

// "open" has nothing withheld to review, so it reads disabled rather than the rail's
// muted "off" tone, which would falsely imply the card is reviewable.
export function deriveBrainIconState(shape: ReturnType<typeof feedStep>): IconState {
  if (shape === "open") return "disabled";
  return shape === "graded" ? "active" : "inactive";
}

export function FeedActionRail({
  card,
  onToggleLike,
  onToggleLearning,
  onOpenSheet,
}: {
  card: Card;
  onToggleLike: () => void;
  onToggleLearning: () => void;
  onOpenSheet: () => void;
}) {
  const shape = feedStep(card);
  const isLiked = card.likedAt !== null;
  const isOpenCard = shape === "open";
  return (
    <div
      className="absolute right-[18px] z-20 flex flex-col gap-[2px]"
      style={{ bottom: FULL_BLEED_PADDING.bottom }}
    >
      <Button
        isIconOnly
        variant="ghost"
        aria-label="Keep"
        aria-pressed={isLiked}
        onPress={onToggleLike}
        className={RAIL_TARGET}
      >
        <Icon
          name="heart"
          size={RAIL_GLYPH_PX}
          {...getIconStateStyle(isLiked ? "active" : "inactive")}
        />
      </Button>
      <Button
        isIconOnly
        variant="ghost"
        aria-label="Review"
        aria-pressed={card.box !== null}
        aria-disabled={isOpenCard || undefined}
        isDisabled={isOpenCard}
        onPress={onToggleLearning}
        className={RAIL_TARGET}
      >
        <Icon
          name="brain"
          size={RAIL_GLYPH_PX}
          {...getIconStateStyle(deriveBrainIconState(shape))}
        />
      </Button>
      <Button
        isIconOnly
        variant="ghost"
        aria-label="More"
        onPress={onOpenSheet}
        className={RAIL_TARGET}
      >
        <Icon name="dots" size={RAIL_GLYPH_PX} className="text-muted" />
      </Button>
    </div>
  );
}
