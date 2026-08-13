import { Button } from "@heroui/react";
import type { Card } from "@vega/shared";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import type { IconName } from "@/core/lib/icon-names";
import { cx, Icon } from "@/core/ui";
import { BARE_CONTROL, BARE_ROW } from "./feed-chrome";
import { offersPromotion } from "./feed-steps";
import type { CardPageLocationState } from "./page/card-page-nav";

const PROMOTE_LABEL = "Hide part of this to review it";
const PROMOTE_SUB =
  "Choose what you want to be able to recall. The card becomes two-sided, and review turns on.";
const ROW_GLYPH_PX = 16;

export function FeedCardSheet({
  card,
  onClose,
  onPromote,
  onToggleLike,
  onHide,
}: {
  card: Card;
  onClose: () => void;
  onPromote: () => void;
  onToggleLike: () => void;
  onHide: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePromote = () => {
    if (card.title.trim() === "") {
      navigate(`/cards/${card.id}`, {
        state: { focusSlot: "title" } satisfies CardPageLocationState,
      });
      return;
    }
    onPromote();
    onClose();
  };

  const rows: { icon: IconName; label: string; onSelect: () => void }[] = [
    {
      icon: "bookmark",
      label: "Keep",
      onSelect: () => {
        onToggleLike();
        onClose();
      },
    },
    { icon: "sliders", label: "Edit card", onSelect: () => navigate(`/cards/${card.id}`) },
    { icon: "plus", label: "Add a card", onSelect: () => navigate("/cards/new") },
    {
      icon: "eye-off",
      label: "Show me this less",
      onSelect: () => {
        onHide();
        onClose();
      },
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/28 outline-none"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Card actions"
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-[26px] rounded-b-[44px] border-border border-t bg-surface px-6 pt-[18px] pb-[30px]"
      >
        <span aria-hidden className="mx-auto h-[3px] w-[34px] rounded-[2px] bg-ink/14" />
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
      </div>
    </div>,
    document.body,
  );
}
