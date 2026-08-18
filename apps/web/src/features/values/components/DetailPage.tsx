/** The furniture every entity detail page wears: ancestor trail, header, labelled sections, footer. */
import { Button } from "@heroui/react";
import type { ReactNode } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { type BreadcrumbItem, cx, EntityBreadcrumb, Icon } from "@/core/ui";

/** Every value- and goal-page trail starts at the values index. */
export const VALUES_ROOT: BreadcrumbItem = { label: "Values", to: "/values" };

export function DetailPage({ trail, children }: { trail: BreadcrumbItem[]; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <EntityBreadcrumb trail={trail} />
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
