import { Button } from "@heroui/react";
import type { Card } from "@vega/shared";
import {
  animate,
  motion,
  type PanInfo,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import type { IconName } from "@/core/lib/icon-names";
import { cx, Icon } from "@/core/ui";
import { BARE_CONTROL, BARE_ROW } from "./feed-chrome";
import { offersPromotion } from "./feed-steps";
import type { CardPageLocationState } from "./page/card-page-nav";
import { decideSheetDrag } from "./sheet-drag";

const PROMOTE_LABEL = "Hide part of this to review it";
const PROMOTE_SUB =
  "Choose what you want to be able to recall. The card becomes two-sided, and review turns on.";
const ROW_GLYPH_PX = 16;
const DRAGGING_BODY_CLASS = "is-dragging-sheet";
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_BACK_TRANSITION = { type: "spring", stiffness: 380, damping: 34 } as const;
const SPRING_BACK_TRANSITION_REDUCED = { duration: 0.15, ease: EASE_IN } as const;

export function FeedCardSheet({
  card,
  onClose,
  onPromote,
  onToggleLike,
  onHide,
  onOpenControl,
}: {
  card: Card;
  onClose: () => void;
  onPromote: () => void;
  onToggleLike: () => void;
  onHide: () => void;
  onOpenControl: () => void;
}) {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const y = useMotionValue(0);
  const dragControls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const close = useCallback(() => {
    closingRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Safety net: an interrupted drag (Escape mid-gesture) must never leave the
  // whole app unselectable, mirroring ColumnResizer's own unmount cleanup.
  useEffect(() => {
    return () => document.body.classList.remove(DRAGGING_BODY_CLASS);
  }, []);

  const handleDragStart = () => {
    document.body.classList.add(DRAGGING_BODY_CLASS);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    document.body.classList.remove(DRAGGING_BODY_CLASS);
    if (closingRef.current) return;
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    const decision = decideSheetDrag(info.offset.y, info.velocity.y, panelHeight);
    if (decision === "dismiss") {
      close();
      return;
    }
    animate(y, 0, shouldReduceMotion ? SPRING_BACK_TRANSITION_REDUCED : SPRING_BACK_TRANSITION);
  };

  const handlePromote = () => {
    if (card.title.trim() === "") {
      navigate(`/cards/${card.id}`, {
        state: { focusSlot: "title" } satisfies CardPageLocationState,
      });
      return;
    }
    onPromote();
    close();
  };

  const rows: { icon: IconName; label: string; onSelect: () => void }[] = [
    {
      icon: "bookmark",
      label: "Keep",
      onSelect: () => {
        onToggleLike();
        close();
      },
    },
    { icon: "sliders", label: "Edit card", onSelect: () => navigate(`/cards/${card.id}`) },
    { icon: "plus", label: "Add a card", onSelect: () => navigate("/cards/new") },
    {
      icon: "filter",
      label: "Customize feed",
      onSelect: () => {
        onOpenControl();
        close();
      },
    },
    {
      icon: "eye-off",
      label: "Show me this less",
      onSelect: () => {
        onHide();
        close();
      },
    },
  ];

  const scrimVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: shouldReduceMotion ? 0.14 : 0.22 } },
    exit: { opacity: 0, transition: { duration: shouldReduceMotion ? 0.1 : 0.18 } },
  };

  const panelVariants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.14 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        initial: { y: "100%" },
        animate: { y: 0, transition: SPRING_BACK_TRANSITION },
        exit: { y: "100%", transition: { duration: 0.28, ease: EASE_IN } },
      };

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <motion.button
        type="button"
        aria-label="Close"
        onClick={close}
        variants={scrimVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute inset-0 bg-ink/28 outline-none"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Card actions"
        variants={panelVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ y }}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: window.innerHeight }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-[26px] rounded-b-[44px] border-border border-t bg-surface px-6 pt-[18px] pb-[30px]"
      >
        <span
          aria-hidden
          onPointerDown={(event) => dragControls.start(event)}
          style={{ touchAction: "none" }}
          className="mx-auto h-[3px] w-[34px] cursor-grab rounded-[2px] bg-ink/14 [-webkit-touch-callout:none]"
        />
        <div className="mt-4 flex flex-col">
          {offersPromotion(card) && (
            <Button
              variant="ghost"
              onPress={handlePromote}
              className={cx(
                BARE_CONTROL,
                "flex w-full flex-col items-start gap-[5px] pt-3 pb-4 focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              <span className="flex w-full items-center gap-3">
                <Icon name="layers" size={ROW_GLYPH_PX} className="text-accent" />
                <span className="flex-1 font-medium text-[16px] text-foreground">
                  {PROMOTE_LABEL}
                </span>
              </span>
              <span className="pl-7 text-[12px] text-muted leading-[1.5]">{PROMOTE_SUB}</span>
            </Button>
          )}
          {rows.map((row) => (
            <Button
              key={row.label}
              variant="ghost"
              onPress={row.onSelect}
              className={cx(BARE_ROW, "focus-visible:ring-2 focus-visible:ring-accent")}
            >
              <Icon name={row.icon} size={ROW_GLYPH_PX} className="text-muted" />
              <span className="flex-1 text-[16px] text-ink-secondary">{row.label}</span>
            </Button>
          ))}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
