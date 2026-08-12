import { type Card, hasReveal } from "@vega/shared";
import { AnimatePresence, motion, type PanInfo, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { ContextMenu, cx, Icon, type MenuItem } from "@/core/ui";
import { CardTurn } from "./face/CardTurn";
import { composeFace } from "./face/compose";

export interface FeedCardViewProps {
  card: Card;
  turned: boolean;
  onTurn: () => void;
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
  const isLiked = card.likedAt !== null;
  const isLearning = card.box !== null;
  return (
    <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-3">
      <AnimatePresence>
        {canGrade && <GradeRailButtons onGrade={onGrade} shouldReduceMotion={shouldReduceMotion} />}
      </AnimatePresence>
      <button
        type="button"
        aria-label="Like card"
        aria-pressed={isLiked}
        onClick={onToggleLike}
        className={cx(
          RAIL_BUTTON,
          isLiked
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-surface/80 text-muted hover:text-foreground",
        )}
      >
        <Icon name="heart" size={20} />
      </button>
      {hasReveal(card) && (
        <button
          type="button"
          aria-label="Learning mode"
          aria-pressed={isLearning}
          onClick={onToggleLearning}
          className={cx(
            RAIL_BUTTON,
            isLearning
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
  turned,
  onTurn,
  onToggleLike,
  onToggleLearning,
  onHide,
  onEdit,
  onManage,
  onGrade,
}: FeedCardViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isPressPending, setIsPressPending] = useState(false);
  const face = useMemo(() => composeFace(card, "face"), [card]);
  const reveal = useMemo(() => (hasReveal(card) ? composeFace(card, "reveal") : null), [card]);
  const canTurn = reveal !== null;
  const canGrade = turned && card.box !== null;
  const faceRef = useRef<HTMLDivElement>(null);
  const voidedDragRef = useRef(false);
  const ariaLabel = card.title.trim() === "" ? "Card" : card.title;

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
          <motion.div
            ref={faceRef}
            className={cx("h-full w-full", canTurn && "cursor-pointer")}
            style={{ touchAction: "pan-y" }}
            drag={canGrade ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={shouldReduceMotion ? 0 : 0.6}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={canTurn ? onTurn : undefined}
          >
            <CardTurn face={face} reveal={reveal} turned={turned} scale={1} fullBleed />
          </motion.div>
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
