import { AnimatePresence, motion, type PanInfo, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import { ContextMenu, cx, Icon, type MenuItem } from "@/core/ui";
import { CardBack, CardFront, ReversedBack, ReversedFront, SingleFaceCard } from "./CardFaces";
import { type FeedCard, resolveBodyVariant } from "./feed-cards";

export interface FeedCardViewProps {
  card: FeedCard;
  reversed: boolean;
  variant: number;
  flipped: boolean;
  onFlip: () => void;
  onToggleLike: () => void;
  onToggleLearning: () => void;
  onHide: () => void;
  onEdit: () => void;
  onManage: () => void;
  onGrade: (correct: boolean) => void;
}

const GRADE_DRAG_RATIO = 0.4;
const GRADE_VELOCITY = 500;
const EDGE_DEAD_ZONE_PX = 24;

const EASE = [0.22, 1, 0.36, 1] as const;
const FACE = "absolute inset-0 [backface-visibility:hidden]";
const RAIL_BUTTON =
  "grid h-11 w-11 place-items-center rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";

function GradeRailButtons({
  onGrade,
  shouldReduceMotion,
}: {
  onGrade: (correct: boolean) => void;
  shouldReduceMotion: boolean | null;
}) {
  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: EASE }}
    >
      <button
        type="button"
        aria-label="Got it"
        onClick={() => onGrade(true)}
        className={cx(RAIL_BUTTON, "border-border bg-surface/80 text-muted hover:text-foreground")}
      >
        <Icon name="check" size={20} />
      </button>
      <button
        type="button"
        aria-label="Again"
        onClick={() => onGrade(false)}
        className={cx(RAIL_BUTTON, "border-border bg-surface/80 text-muted hover:text-foreground")}
      >
        <Icon name="repeat" size={20} />
      </button>
    </motion.div>
  );
}

function RightRail({
  card,
  canGrade,
  shouldReduceMotion,
  onToggleLike,
  onToggleLearning,
  onGrade,
}: Pick<FeedCardViewProps, "card" | "onToggleLike" | "onToggleLearning" | "onGrade"> & {
  canGrade: boolean;
  shouldReduceMotion: boolean | null;
}) {
  return (
    <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-3">
      <AnimatePresence>
        {canGrade && <GradeRailButtons onGrade={onGrade} shouldReduceMotion={shouldReduceMotion} />}
      </AnimatePresence>
      <button
        type="button"
        aria-label="Like card"
        aria-pressed={card.liked}
        onClick={onToggleLike}
        className={cx(
          RAIL_BUTTON,
          card.liked
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-surface/80 text-muted hover:text-foreground",
        )}
      >
        <Icon name="heart" size={20} />
      </button>
      {card.hasReveal && (
        <button
          type="button"
          aria-label="Learning mode"
          aria-pressed={card.learning}
          onClick={onToggleLearning}
          className={cx(
            RAIL_BUTTON,
            card.learning
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-surface/80 text-muted hover:text-foreground",
          )}
        >
          <Icon name="brain" size={20} />
        </button>
      )}
    </div>
  );
}

export function FeedCardView({
  card,
  reversed,
  variant,
  flipped,
  onFlip,
  onToggleLike,
  onToggleLearning,
  onHide,
  onEdit,
  onManage,
  onGrade,
}: FeedCardViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const backBody = resolveBodyVariant(card, variant);
  const [isPressPending, setIsPressPending] = useState(false);
  const canFlip = card.hasReveal && card.body !== "";
  const canGrade = flipped && card.learning;
  const faceRef = useRef<HTMLDivElement>(null);
  const voidedDragRef = useRef(false);
  const ariaLabel = card.title || "Card";

  const menuItems: MenuItem[] = [
    { label: "Not interested", icon: "eye-off", onSelect: onHide },
    { label: "Edit", icon: "edit", onSelect: onEdit },
    { label: "Manage cards", icon: "sliders", onSelect: onManage },
  ];

  const handleDragStart = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const pointerX = info.point.x;
    voidedDragRef.current =
      pointerX <= EDGE_DEAD_ZONE_PX || pointerX >= window.innerWidth - EDGE_DEAD_ZONE_PX;
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (voidedDragRef.current) {
      voidedDragRef.current = false;
      return;
    }
    const cardWidth = faceRef.current?.offsetWidth ?? 0;
    const passedDistance = cardWidth > 0 && Math.abs(info.offset.x) >= cardWidth * GRADE_DRAG_RATIO;
    const passedVelocity = Math.abs(info.velocity.x) >= GRADE_VELOCITY;
    if (passedDistance || passedVelocity) onGrade(info.offset.x > 0);
  };

  return (
    <ContextMenu items={menuItems} longPress onLongPressPending={setIsPressPending}>
      <article
        aria-label={ariaLabel}
        className="relative h-full w-full select-none [-webkit-touch-callout:none]"
      >
        <div
          className={cx(
            "h-full w-full",
            !shouldReduceMotion && "transition-transform duration-150",
          )}
          style={{ transform: isPressPending ? "scale(0.98)" : undefined }}
        >
          {card.hasReveal ? (
            <motion.div
              ref={faceRef}
              className="h-full w-full"
              style={{ touchAction: "pan-y" }}
              drag={canGrade ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={shouldReduceMotion ? 0 : 0.6}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="h-full w-full [perspective:1200px]">
                <motion.div
                  className={cx("relative h-full w-full", canFlip && "cursor-pointer")}
                  style={{ transformStyle: "preserve-3d" }}
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE }}
                  onClick={canFlip ? onFlip : undefined}
                >
                  <div className={FACE}>
                    {reversed ? <ReversedFront card={card} /> : <CardFront card={card} />}
                  </div>
                  <div className={cx(FACE, "[transform:rotateY(180deg)]")}>
                    {reversed ? (
                      <ReversedBack card={card} body={backBody} />
                    ) : (
                      <CardBack body={backBody} />
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <SingleFaceCard card={card} />
          )}
        </div>

        <RightRail
          card={card}
          canGrade={canGrade}
          shouldReduceMotion={shouldReduceMotion}
          onToggleLike={onToggleLike}
          onToggleLearning={onToggleLearning}
          onGrade={onGrade}
        />
      </article>
    </ContextMenu>
  );
}
