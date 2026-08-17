import type { IconName } from "@/core/lib/icon-names";
import { cx, Icon } from "@/core/ui";

export type StateChipTone = "neutral" | "refund" | "amended";

const TONE_CLASS: Record<StateChipTone, string> = {
  neutral: "text-muted",
  refund: "text-success",
  amended: "text-warning",
};

export interface StateChipProps {
  label: string;
  tone?: StateChipTone;
  /** A `spread ×12` chip carries `calendar-range`; most state chips carry nothing. */
  icon?: IconName;
  className?: string;
}

/** The 20px marginal note that rides beside a row title — never a colour-only signal. */
export function StateChip({ label, tone = "neutral", icon, className }: StateChipProps) {
  return (
    <span
      className={cx(
        "inline-flex h-5 items-center gap-[5px] rounded-[10px] border border-border px-2 text-[11px] font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={12} aria-hidden />}
      {label}
    </span>
  );
}
