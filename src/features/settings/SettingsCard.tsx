import type { ReactNode } from "react";
import { cx } from "@/core/ui";

/**
 * A vapor settings card: white surface, hairline border, soft shadow, rounded.
 * Section title in Space Grotesk (font-display); body in Inter.
 */
export function SettingsCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--color-ink)]">
            {title}
          </h2>
          {description != null && (
            <p className="mt-1 font-sans text-sm leading-relaxed text-[var(--color-muted)]">
              {description}
            </p>
          )}
        </div>
        {action != null && <div className="shrink-0">{action}</div>}
      </div>
      {children != null && <div className="mt-5">{children}</div>}
    </section>
  );
}
