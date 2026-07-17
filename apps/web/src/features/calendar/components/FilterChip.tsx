import { cx } from "@/core/ui";

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "bg-surface-secondary text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
