import { Checkbox } from "@heroui/react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

/**
 * A checkbox that draws its own box.
 *
 * HeroUI's `Checkbox.Indicator` renders its child whether or not the box is selected, so a
 * composed checkbox shows a tick in every row and nothing tells you what is actually picked.
 * Here selection drives the mark directly, which also gives the box a visible resting outline.
 */
export function CheckField({
  isSelected,
  onChange,
  label,
  children,
  className,
  isTouchTarget = false,
}: {
  isSelected: boolean;
  onChange: () => void;
  /** accessible name — the visible text, when there is one, goes in `children` */
  label: string;
  children?: ReactNode;
  className?: string;
  /** grow the pressable to a thumb-sized hit area around the 15px box, without scaling it */
  isTouchTarget?: boolean;
}) {
  return (
    <Checkbox isSelected={isSelected} onChange={onChange} aria-label={label}>
      {/* `Checkbox.Content` is the label, and the label is what takes the press — size it, not the root. */}
      <Checkbox.Content
        className={cx(
          "flex items-center gap-2.5",
          isTouchTarget ? "h-11 w-11 justify-center" : "w-full",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border transition-colors",
            isSelected
              ? "border-accent bg-accent text-accent-foreground"
              : "border-line-strong bg-surface text-transparent",
          )}
        >
          {isSelected && <Icon name="check" size={11} />}
        </span>
        {children}
      </Checkbox.Content>
    </Checkbox>
  );
}
