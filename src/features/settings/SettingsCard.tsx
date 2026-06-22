import { Card, CardBody, CardHeader } from "@heroui/react";
import type { ReactNode } from "react";

/**
 * A calm settings card on HeroUI <Card> (shadow="sm"): white surface, hairline
 * border, barely-there shadow. Quiet sentence-case Inter title — no eyebrow,
 * no rule. Optional description under the title and an action on the right.
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
    <Card as="section" shadow="sm" radius="lg" className={className}>
      <CardHeader className="flex items-start justify-between gap-4 px-6 pb-0 pt-6">
        <div className="min-w-0">
          <h2 className="text-medium font-semibold tracking-tight text-foreground">{title}</h2>
          {description != null && (
            <p className="mt-1 text-small leading-relaxed text-default-500">{description}</p>
          )}
        </div>
        {action != null && <div className="shrink-0">{action}</div>}
      </CardHeader>
      {children != null && <CardBody className="px-6 pb-6 pt-5">{children}</CardBody>}
    </Card>
  );
}
