import { cx } from "../cx";

export const triggerCx =
  "flex w-full items-center justify-between gap-2 bg-transparent text-left font-sans text-[13px] text-[var(--color-ink)] outline-none";

/** Field-style trigger shared by the pickers: hairline box, label above, value below. */
export function PickerField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-2",
        className,
      )}
    >
      <span className="font-sans text-[10px] font-medium uppercase leading-none tracking-[0.14em] text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}
