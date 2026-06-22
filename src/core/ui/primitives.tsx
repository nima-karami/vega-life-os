import { Card, Chip, Button as HButton, type ButtonProps as HButtonProps } from "@heroui/react";
import type { ReactNode } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { cx } from "./cx";
import { Icon } from "./icons";

/**
 * Small, quiet muted label — connective tissue. Sentence case, not uppercase-tracked
 * (per the calm contract). `ink` bumps it to the foreground color.
 */
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
    <span className={cx("text-tiny", ink ? "text-foreground" : "text-default-500", className)}>
      {children}
    </span>
  );
}

/** Panel header: a quiet title with optional meta on the right — no rule, no uppercase. */
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
      <span className="text-small font-medium text-foreground">{title}</span>
      {meta != null && <span className="text-tiny text-default-400">{meta}</span>}
    </div>
  );
}

/**
 * Calm surface card on HeroUI <Card> (shadow="sm"). Keeps the legacy <Panel> API
 * (children, className, flush, as, ticks no-op) so call sites don't change.
 */
export function Panel({
  children,
  className,
  flush,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  /** @deprecated Legacy HUD corner ticks — accepted for API compat, no longer rendered. */
  ticks?: boolean;
  flush?: boolean;
  as?: "div" | "section" | "article";
}) {
  return (
    <Card
      as={As}
      shadow={flush ? "none" : "sm"}
      radius="lg"
      className={cx("border border-divider bg-content1", className)}
    >
      {children}
    </Card>
  );
}

/** Small status/category chip on HeroUI <Chip>. Keeps the legacy <Tag> API. */
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
    <Chip
      size="sm"
      radius="full"
      variant={active ? "solid" : "flat"}
      color={active ? "primary" : "default"}
      className={className}
    >
      {children}
    </Chip>
  );
}

// Built on HeroUI ButtonProps so call sites can also pass HeroUI props directly.
type BtnProps = Omit<HButtonProps, "color" | "variant" | "startContent"> & {
  solid?: boolean;
  icon?: IconName;
};
/**
 * Calm button on HeroUI <Button>. `solid` → primary solid; otherwise a quiet
 * flat secondary. Forwards HeroUI/native button props (onClick, onPress, type, …).
 */
export function Button({ solid, icon, children, className, type, ...rest }: BtnProps) {
  return (
    <HButton
      type={type ?? "button"}
      size="sm"
      radius="sm"
      color={solid ? "primary" : "default"}
      variant={solid ? "solid" : "flat"}
      startContent={icon ? <Icon name={icon} size={14} /> : undefined}
      className={cx("font-medium", className)}
      {...rest}
    >
      {children}
    </HButton>
  );
}

/** Icon-only button on HeroUI <Button isIconOnly variant="light">. Keeps the legacy API. */
export function IconButton({
  name,
  size = 16,
  label,
  className,
  type,
  ...rest
}: { name: IconName; size?: number; label: string } & Omit<
  HButtonProps,
  "isIconOnly" | "variant" | "startContent" | "size"
>) {
  return (
    <HButton
      isIconOnly
      type={type ?? "button"}
      size="sm"
      radius="sm"
      variant="light"
      aria-label={label}
      title={label}
      className={cx("text-default-500 data-[hover=true]:text-foreground", className)}
      {...rest}
    >
      <Icon name={name} size={size} />
    </HButton>
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
      className={n <= v ? "text-primary" : "text-default-300"}
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
        "flex flex-col gap-1 rounded-medium border border-divider bg-content1 px-3 py-2.5",
        className,
      )}
    >
      <Label>{label}</Label>
      <span className="text-xl font-semibold leading-none tracking-tight text-foreground">
        {value}
      </span>
    </div>
  );
}
