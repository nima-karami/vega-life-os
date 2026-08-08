/** The furniture every entity detail page wears: back link, header, labelled sections, footer. */
import { Button } from "@heroui/react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { IconName } from "@/core/lib/icon-names";
import { cx, Icon } from "@/core/ui";

export function DetailPage({
  backTo,
  backLabel,
  children,
}: {
  backTo: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-foreground"
      >
        <Icon name="chevL" size={14} />
        {backLabel}
      </Link>
      {children}
    </div>
  );
}

export function DetailHeader({
  disc,
  title,
  meta,
  actions,
}: {
  disc: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mt-3.5 flex items-start gap-3.5">
      <span className="mt-0.5 shrink-0">{disc}</span>
      <div className="min-w-0 flex-1">
        {title}
        {meta}
      </div>
      {actions}
    </div>
  );
}

export function DetailSection({
  label,
  caps,
  children,
}: {
  label: string;
  /** Uppercase tracked label — marks a list of entities rather than a form control. */
  caps?: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <span
        className={cx(
          "block text-[12px] text-muted",
          caps && "font-medium uppercase tracking-[.06em]",
        )}
      >
        {label}
      </span>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export function DetailFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-border pt-5">
      {children}
    </div>
  );
}

export function DetailAction({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onPress={onPress}
      className={cx("px-2 font-medium", danger ? "text-danger" : "text-muted")}
    >
      <Icon name={icon} size={14} />
      {label}
    </Button>
  );
}
