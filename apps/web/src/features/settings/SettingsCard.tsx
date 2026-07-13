import { Card } from "@heroui/react";
import type { ReactNode } from "react";
import { cx } from "@/core/ui";

/**
 * A calm settings card on HeroUI v3 <Card>: surface, hairline border, soft
 * radius. Quiet sentence-case Inter title — no eyebrow, no rule. Optional
 * description under the title and an action on the right.
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
    <Card className={cx("rounded-[16px] border border-border bg-surface", className)}>
      <Card.Header className="flex items-start justify-between gap-4 px-6 pb-0 pt-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description != null && (
            <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {action != null && <div className="shrink-0">{action}</div>}
      </Card.Header>
      {children != null && <Card.Content className="px-6 pb-6 pt-5">{children}</Card.Content>}
    </Card>
  );
}
