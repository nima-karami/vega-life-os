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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      style={{ color: n <= v ? "var(--color-ink)" : "var(--color-line-strong)" }}>
      <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8z" />
    </svg>
  );
  // read-only: plain spans so it can nest inside a button without invalid DOM
  if (!onChange) {
    return (
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => <Star key={n} n={n} />)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n === value ? 0 : n)}
          aria-label={`${n} star`} className="cursor-pointer leading-none">
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
        "panel-flush flex flex-col gap-1 px-3 py-2.5",
        className,
      )}
    >
      <Label>{label}</Label>
      <span className="display text-xl leading-none">{value}</span>
    </div>
  );
}
