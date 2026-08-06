import type { ReactNode } from "react";
import { cx } from "./cx";

/** A quiet label above the control it names — the one label-above-control wrapper. */
export function EditorField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("space-y-2.5", className)}>
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}
