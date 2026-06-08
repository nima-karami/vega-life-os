import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";
import type { IconName } from "@/core/lib/icon-names";

/** A small uppercase tracked mono label — the HUD's connective tissue. */
export function Label({
  children,
  className,
  ink,
}: {
  children: ReactNode;
  className?: string;
  ink?: boolean;
}) {
  return (
    <span className={cx("label", ink && "label-ink", className)}>{children}</span>
  );
}

/** Panel header: "// TITLE ———————————— meta" */
export function SectionHead({
  title,
  meta,
  className,
  slash = true,
}: {
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
  slash?: boolean;
}) {
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <Label ink>
        {slash && <span className="text-stone">// </span>}
        {title}
      </Label>
      <div className="h-px flex-1 bg-[var(--color-line)]" />
      {meta != null && <Label>{meta}</Label>}
    </div>
  );
}

export function Panel({
  children,
  className,
  ticks,
  flush,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  ticks?: boolean;
  flush?: boolean;
  as?: "div" | "section" | "article";
}) {
  return (
    <As
      className={cx(flush ? "panel-flush" : "panel", ticks && "ticks", className)}
    >
      {children}
    </As>
  );
}

export function Tag({
  children,
  active,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "mono inline-flex items-center gap-1 border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]",
        active
          ? "border-ink bg-ink text-paper"
          : "border-[var(--color-line)] text-stone",
        className,
      )}
    >
      {children}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  solid?: boolean;
  icon?: IconName;
};
export function Button({ solid, icon, children, className, ...rest }: BtnProps) {
  return (
    <button
      className={cx(
        "btn inline-flex items-center gap-2",
        solid && "btn-solid",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </button>
  );
}

export function IconButton({
  name,
  size = 16,
  label,
  className,
  ...rest
}: { name: IconName; size?: number; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "grid h-8 w-8 place-items-center rounded-[2px] border border-[var(--color-line)] text-ash transition-colors hover:bg-ink hover:text-paper",
        className,
      )}
      {...rest}
    >
      <Icon name={name} size={size} />
    </button>
  );
}

export function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "panel-flush flex flex-col gap-1 px-3 py-2.5",
        className,
      )}
    >
      <Label>{label}</Label>
      <span className="display text-xl leading-none">{value}</span>
    </div>
  );
}
