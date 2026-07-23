import { Button } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import { cx, Icon, Label, Menu } from "@/core/ui";
import type { FeedCard } from "./feed-cards";
import { CardMarkdown } from "./markdown-view";

export interface FeedCardViewProps {
  card: FeedCard;
  flipped: boolean;
  onFlip: () => void;
  onToggleLearning: () => void;
  onHide: () => void;
  onEdit: () => void;
}

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

function RightRail({
  card,
  onToggleLearning,
  onHide,
  onEdit,
}: Omit<FeedCardViewProps, "flipped" | "onFlip">) {
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
  flipped,
  onFlip,
  onToggleLearning,
  onHide,
  onEdit,
}: FeedCardViewProps) {
  const reduce = useReducedMotion();
  const canFlip = card.body !== "";
  const ariaLabel = card.kind === "vocab" ? `Vocabulary card: ${card.title}` : card.title || "Card";

  return (
    <article aria-label={ariaLabel} className="relative h-full w-full select-none">
      <div className="h-full w-full [perspective:1200px]">
        <motion.div
          className={cx("relative h-full w-full", canFlip && "cursor-pointer")}
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE }}
          onClick={canFlip ? onFlip : undefined}
        >
          <div className={FACE}>
            <CardFront card={card} />
          </div>
          <div className={cx(FACE, "[transform:rotateY(180deg)]")}>
            <CardBack card={card} />
          </div>
        </motion.div>
      </div>

      {canFlip && (
        <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center">
          <Button size="sm" variant="secondary" aria-expanded={flipped} onPress={onFlip}>
            Flip
          </Button>
        </div>
      )}

      <RightRail card={card} onToggleLearning={onToggleLearning} onHide={onHide} onEdit={onEdit} />
    </article>
  );
}
