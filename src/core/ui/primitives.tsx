import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { cx } from "./cx";
import { Icon } from "./icons";

/** A small uppercase tracked label — connective tissue, set in Inter. */
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
    <span
      className={cx(
        "font-sans text-[10px] font-medium uppercase leading-none tracking-[0.14em]",
        ink ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Panel header: a quiet uppercase title with optional meta on the right — no rule. */
export function SectionHead({
  title,
  meta,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3", className)}>
      <Label ink>{title}</Label>
      {meta != null && <Label>{meta}</Label>}
    </div>
  );
}

export function Panel({
  children,
  className,
  flush,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  /** @deprecated Legacy HUD corner ticks — accepted for API compat but no longer rendered in the vapor theme. */
  ticks?: boolean;
  flush?: boolean;
  as?: "div" | "section" | "article";
}) {
  return (
    <As
      className={cx(
        flush
          ? "border border-[var(--color-line)] bg-[var(--color-surface)] rounded-[var(--radius-md)]"
          : "border border-[var(--color-line)] bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-soft)]",
        className,
      )}
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.12em]",
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
          : "border-[var(--color-line)] text-[var(--color-muted)]",
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
      type="button"
      className={cx(
        "inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-4 py-2 font-sans text-[13px] font-medium transition-colors duration-150",
        solid
          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:opacity-90"
          : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)] hover:border-[var(--color-accent)]",
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
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-line)] text-[var(--color-muted)] transition-colors duration-150 hover:bg-[var(--color-canvas)] hover:border-[var(--color-accent)] hover:text-[var(--color-ink)]",
        className,
      )}
      {...rest}
    >
      <Icon name={name} size={size} />
    </button>
  );
}

export function Stars({
  value,
  onChange,
  size = 14,
}: {
  value: number | null;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const v = value ?? 0;
  const Star = ({ n }: { n: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: n <= v ? "var(--color-accent)" : "var(--color-line-strong)" }}
    >
      <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8z" />
    </svg>
  );
  // read-only: plain spans so it can nest inside a button without invalid DOM
  if (!onChange) {
    return (
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} n={n} />
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          aria-label={`${n} star`}
          className="cursor-pointer leading-none"
        >
          <Star n={n} />
        </button>
      ))}
    </span>
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
        "flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5",
        className,
      )}
    >
      <Label>{label}</Label>
      <span className="font-display text-xl font-bold leading-none tracking-[-0.03em]">
        {value}
      </span>
    </div>
  );
}
