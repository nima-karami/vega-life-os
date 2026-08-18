import type { ReactNode } from "react";
import { cx } from "@/core/ui";

const CARD_CLASS = "rounded-[16px] border border-border bg-surface shadow-soft";

/** Every block on the overview is the same white card; only the padding changes. */
export function OverviewCard({
  label,
  className,
  children,
}: {
  /** Names the card as a landmark where its own heading interpolates the month. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className={cx(CARD_CLASS, "px-5 py-[18px]", className)}>
      {children}
    </section>
  );
}

/** A card heading and the qualifier that tells you what the figures beside it mean. */
export function CardHeadRow({ title, qualifier }: { title: string; qualifier: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-semibold text-[15px] text-foreground">{title}</h2>
      <span className="text-[12px] text-muted">{qualifier}</span>
    </div>
  );
}

/** Every chart ends in one sentence stating the finding — amber only when the finding is a warning. */
export function ChartCaption({ text, isWarning = false }: { text: string; isWarning?: boolean }) {
  return (
    <p className={cx("mt-1.5 text-[12px]", isWarning ? "text-warning" : "text-muted")}>{text}</p>
  );
}
