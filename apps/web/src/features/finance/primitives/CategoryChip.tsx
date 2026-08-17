import { cx, Icon } from "@/core/ui";

export type CategoryChipTone = "assigned" | "guess" | "missing";

const TONE_CLASS: Record<CategoryChipTone, string> = {
  assigned: "border-border bg-surface font-normal text-foreground",
  guess: "border-border bg-surface font-normal text-muted",
  missing: "border-dashed border-warning font-medium text-warning",
};

export interface CategoryChipProps {
  label: string;
  tone?: CategoryChipTone;
  /** The category's palette colour — the 8px swatch a named category always carries. */
  color?: string;
  onPress?: () => void;
  className?: string;
}

/**
 * One chip for the three things a row's category can be: named, guessed by the merchant table,
 * or missing. A guess stays muted and ends in a `?` — it is a suggestion until accepted.
 */
export function CategoryChip({
  label,
  tone = "assigned",
  color,
  onPress,
  className,
}: CategoryChipProps) {
  const chipClass = cx(
    "inline-flex h-[26px] items-center gap-[7px] rounded-[10px] border px-2.5 text-[12.5px]",
    TONE_CLASS[tone],
    className,
  );
  const content = (
    <>
      {color !== undefined && tone !== "missing" && (
        <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} />
      )}
      {tone === "guess" ? `${label}?` : label}
      {tone === "guess" && <Icon name="sparkles" size={12} aria-hidden />}
    </>
  );

  if (!onPress) return <span className={chipClass}>{content}</span>;
  return (
    <button type="button" onClick={onPress} className={chipClass}>
      {content}
    </button>
  );
}
