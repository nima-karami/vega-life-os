import { Button } from "@heroui/react";
import {
  CARD_TYPE_IDS,
  CARD_TYPES,
  type Card,
  type CardPrefs,
  isCardCategoryIncluded,
} from "@vega/shared";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cx, Icon } from "@/core/ui";
import { BARE_CONTROL } from "./feed-chrome";
import { describeModeMeta, describeShowAction } from "./feed-control-copy";
import { buildFeedPool, countFeedDue } from "./feed-pool";
import { listCardCategories } from "./queries";

export type FeedControlDraft = Pick<CardPrefs, "mode" | "types" | "categories">;

const EVERYTHING: FeedControlDraft = { mode: "mix", types: [], categories: [] };

const MODE_ROWS: { mode: CardPrefs["mode"]; label: string }[] = [
  { mode: "due", label: "Review what is due" },
  { mode: "mix", label: "Mix review into the feed" },
  { mode: "read", label: "Just read" },
];

const SECTION_LABEL = "font-medium font-mono text-[9.5px] text-muted tracking-[.12em] uppercase";
const CHIP_BASE =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-[15px] font-medium text-[14px] shadow-none focus-visible:ring-2 focus-visible:ring-accent";
const MODE_ROW = `${BARE_CONTROL} flex min-h-[56px] w-full items-center gap-[14px] border-border border-t focus-visible:ring-2 focus-visible:ring-accent`;

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function ControlChip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      aria-pressed={active}
      onPress={onToggle}
      className={cx(
        CHIP_BASE,
        active
          ? "border-accent bg-accent/9 text-foreground data-[hovered=true]:bg-accent/9"
          : "border-ink/14 text-muted data-[hovered=true]:bg-transparent",
      )}
    >
      {label}
    </Button>
  );
}

export function FeedControlPage({
  cards,
  prefs,
  today,
  onApply,
  onClose,
}: {
  cards: Card[];
  prefs: CardPrefs;
  today: string;
  onApply: (draft: FeedControlDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FeedControlDraft>({
    mode: prefs.mode,
    types: prefs.types,
    categories: prefs.categories,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preview = useMemo(() => ({ ...prefs, ...draft }), [prefs, draft]);
  const dueCount = countFeedDue(cards, preview, today);
  const resultCount = buildFeedPool(cards, preview, today).length;
  const categories = useMemo(() => listCardCategories(cards), [cards]);
  // Empty means "All", so a chip is only lit when the list actually names it.
  const isCategoryOn = (label: string): boolean =>
    draft.categories.length > 0 && isCardCategoryIncluded({ categories: draft.categories }, label);

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-surface">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-[30px] pt-14 pb-[26px]">
        <div className="flex min-h-11 items-center gap-[14px]">
          <Button
            isIconOnly
            variant="ghost"
            aria-label="Back to the feed"
            onPress={onClose}
            className="grid h-11 w-11 place-items-center rounded-none bg-transparent p-0 shadow-none data-[hovered=true]:bg-transparent focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name="chevL" size={20} className="text-foreground" />
          </Button>
          <h1 className="flex-1 font-semibold text-[19px] text-foreground tracking-[-.02em]">
            What you see
          </h1>
        </div>

        <p className={cx(SECTION_LABEL, "mt-[22px] mb-3")}>Mode</p>
        <div className="flex flex-col">
          {MODE_ROWS.map((row) => {
            const isSelected = draft.mode === row.mode;
            return (
              <Button
                key={row.mode}
                variant="ghost"
                aria-pressed={isSelected}
                onPress={() => setDraft((current) => ({ ...current, mode: row.mode }))}
                className={MODE_ROW}
              >
                <span className="grid w-[18px] place-items-center">
                  {isSelected && <Icon name="check" size={16} className="text-accent" />}
                </span>
                <span
                  className={cx(
                    "flex-1 text-[17px]",
                    isSelected ? "font-medium text-foreground" : "text-ink-secondary",
                  )}
                >
                  {row.label}
                </span>
                <span className="font-medium font-mono text-[9.5px] text-muted tracking-[.08em]">
                  {describeModeMeta(row.mode, dueCount)}
                </span>
              </Button>
            );
          })}
        </div>

        <p className={cx(SECTION_LABEL, "mt-[30px] mb-3")}>Type</p>
        <div className="flex flex-wrap gap-2">
          <ControlChip
            label="All"
            active={draft.types.length === 0}
            onToggle={() => setDraft((current) => ({ ...current, types: [] }))}
          />
          {CARD_TYPE_IDS.map((id) => (
            <ControlChip
              key={id}
              label={CARD_TYPES[id].label}
              active={draft.types.includes(id)}
              onToggle={() =>
                setDraft((current) => ({ ...current, types: toggleInList(current.types, id) }))
              }
            />
          ))}
        </div>

        <p className={cx(SECTION_LABEL, "mt-[30px] mb-3")}>Category</p>
        <div className="flex flex-wrap gap-2">
          <ControlChip
            label="All"
            active={draft.categories.length === 0}
            onToggle={() => setDraft((current) => ({ ...current, categories: [] }))}
          />
          {categories.map((category) => (
            <ControlChip
              key={category}
              label={category}
              active={isCategoryOn(category)}
              onToggle={() =>
                setDraft((current) => ({
                  ...current,
                  categories: toggleInList(current.categories, category),
                }))
              }
            />
          ))}
        </div>

        <span className="flex-1" />

        <Button
          variant="ghost"
          onPress={() => setDraft(EVERYTHING)}
          className={cx(
            BARE_CONTROL,
            "flex min-h-11 w-full items-center focus-visible:ring-2 focus-visible:ring-accent",
          )}
        >
          <span className="font-medium text-[15px] text-muted">Reset to everything</span>
        </Button>
        <Button
          variant="ghost"
          onPress={() => onApply(draft)}
          className={cx(
            BARE_CONTROL,
            "flex min-h-[56px] w-full items-center border-border border-t focus-visible:ring-2 focus-visible:ring-accent",
          )}
        >
          <span className="flex-1 font-medium text-[18px] text-accent">
            {describeShowAction(resultCount)}
          </span>
          <Icon name="arrow-right" size={18} className="text-accent" />
        </Button>
      </div>
    </div>,
    document.body,
  );
}
