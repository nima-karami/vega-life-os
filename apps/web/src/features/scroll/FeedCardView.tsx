import { Button } from "@heroui/react";
import { motion, type PanInfo, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { cx, Icon, Label, Menu } from "@/core/ui";
import type { FeedCard } from "./feed-cards";
import { CardMarkdown } from "./markdown-view";

export interface FeedCardViewProps {
  card: FeedCard;
  reversed: boolean;
  flipped: boolean;
  onFlip: () => void;
  onToggleLearning: () => void;
  onHide: () => void;
  onEdit: () => void;
  onGrade: (correct: boolean) => void;
}

const GRADE_DRAG_RATIO = 0.4;
const GRADE_VELOCITY = 500;
const EDGE_DEAD_ZONE_PX = 24;

const EASE = [0.22, 1, 0.36, 1] as const;
const FACE = "absolute inset-0 [backface-visibility:hidden]";
const RAIL_BUTTON =
  "grid h-11 w-11 place-items-center rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";

function titleSizeClass(title: string): string {
  return title.length > 120 ? "text-xl" : "text-3xl";
}

function CardFront({ card }: { card: FeedCard }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24 text-center">
      <Label className="uppercase tracking-wide">{card.category}</Label>
      <div className="flex flex-1 items-center justify-center">
        <h2
          className={cx(
            "line-clamp-6 font-semibold tracking-tight text-foreground",
            titleSizeClass(card.title),
          )}
        >
          {card.title}
        </h2>
      </div>
      {card.source ? <p className="text-sm text-muted">{card.source}</p> : <span aria-hidden />}
    </div>
  );
}

function CardBack({ card }: { card: FeedCard }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24">
      <div className="flex-1 overflow-y-auto">
        <CardMarkdown markdown={card.body} className="journal-prose text-left" />
      </div>
    </div>
  );
}

function ReversedFront({ card }: { card: FeedCard }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24 text-center">
      <Label className="uppercase tracking-wide">{card.category}</Label>
      <div className="flex flex-1 items-center justify-center overflow-y-auto">
        <CardMarkdown markdown={card.maskedBody ?? card.body} className="journal-prose text-left" />
      </div>
      <p className="text-sm text-muted">What's this called?</p>
    </div>
  );
}

function ReversedBack({ card }: { card: FeedCard }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24">
      <h2
        className={cx(
          "mb-4 font-semibold tracking-tight text-foreground",
          titleSizeClass(card.title),
        )}
      >
        {card.title}
      </h2>
      <div className="flex-1 overflow-y-auto">
        <CardMarkdown markdown={card.body} className="journal-prose text-left" />
      </div>
    </div>
  );
}

function GradeButtons({ onGrade }: { onGrade: (correct: boolean) => void }) {
  return (
    <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center gap-4 px-8">
      <Button
        size="lg"
        variant="secondary"
        className="min-h-12 w-32"
        onPress={() => onGrade(false)}
      >
        Again
      </Button>
      <Button size="lg" variant="primary" className="min-h-12 w-32" onPress={() => onGrade(true)}>
        Got it
      </Button>
    </div>
  );
}

function RightRail({
  card,
  onToggleLearning,
  onHide,
  onEdit,
}: Pick<FeedCardViewProps, "card" | "onToggleLearning" | "onHide" | "onEdit">) {
  const isVocab = card.kind === "vocab";
  return (
    <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-3">
      <button
        type="button"
        aria-label="Learning mode"
        aria-pressed={card.learning}
        aria-disabled={isVocab || undefined}
        disabled={isVocab}
        title={isVocab ? "Vocabulary is always in learning mode" : undefined}
        onClick={isVocab ? undefined : onToggleLearning}
        className={cx(
          RAIL_BUTTON,
          card.learning
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-surface/80 text-muted hover:text-foreground",
          isVocab && "opacity-60",
        )}
      >
        <Icon name="brain" size={20} />
      </button>
      <button
        type="button"
        aria-label="Hide card"
        onClick={onHide}
        className={cx(RAIL_BUTTON, "border-border bg-surface/80 text-muted hover:text-foreground")}
      >
        <Icon name="eye-off" size={20} />
      </button>
      {!isVocab && (
        <Menu
          isIconOnly
          triggerContent={<Icon name="dots" size={20} />}
          triggerLabel="More actions"
          triggerClassName="h-11 w-11 rounded-full border border-border bg-surface/80"
          items={[{ label: "Edit", icon: "edit", onSelect: onEdit }]}
        />
      )}
    </div>
  );
}

export function FeedCardView({
  card,
  reversed,
  flipped,
  onFlip,
  onToggleLearning,
  onHide,
  onEdit,
  onGrade,
}: FeedCardViewProps) {
  const reduce = useReducedMotion();
  const canFlip = card.body !== "";
  const canGrade = flipped && card.learning;
  const faceRef = useRef<HTMLDivElement>(null);
  const voidedDragRef = useRef(false);
  const ariaLabel = card.kind === "vocab" ? `Vocabulary card: ${card.title}` : card.title || "Card";

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
    <article aria-label={ariaLabel} className="relative h-full w-full select-none">
      <motion.div
        ref={faceRef}
        className="h-full w-full"
        style={{ touchAction: "pan-y" }}
        drag={canGrade ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={reduce ? 0 : 0.6}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="h-full w-full [perspective:1200px]">
          <motion.div
            className={cx("relative h-full w-full", canFlip && "cursor-pointer")}
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE }}
            onClick={canFlip ? onFlip : undefined}
          >
            <div className={FACE}>
              {reversed ? <ReversedFront card={card} /> : <CardFront card={card} />}
            </div>
            <div className={cx(FACE, "[transform:rotateY(180deg)]")}>
              {reversed ? <ReversedBack card={card} /> : <CardBack card={card} />}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {canGrade ? (
        <GradeButtons onGrade={onGrade} />
      ) : (
        canFlip && (
          <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center">
            <Button size="sm" variant="secondary" aria-expanded={flipped} onPress={onFlip}>
              {reversed ? "Reveal" : "Flip"}
            </Button>
          </div>
        )
      )}

      <RightRail card={card} onToggleLearning={onToggleLearning} onHide={onHide} onEdit={onEdit} />
    </article>
  );
}
