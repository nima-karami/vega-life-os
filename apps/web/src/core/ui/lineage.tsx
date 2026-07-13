/** Value → Goal → Habit chain as inline text. The value-colored left stripe is the
 * owning card's concern — use `getValueStripeStyle()` for it. */
import type { TaskLineage } from "@/features/tasks/lineage";
import { getValueColor } from "@/features/values/color";
import { cx } from "./cx";

export interface LineageProps {
  lineage: TaskLineage;
  variant?: "card" | "inline";
  className?: string;
}

export function Lineage({ lineage, variant = "inline", className }: LineageProps) {
  const { value, goal, fromHabit } = lineage;

  const isUnlinked = !value && !goal && !fromHabit;

  return (
    <span
      className={cx(
        "inline-flex flex-wrap items-center gap-x-1 font-sans text-xs",
        variant === "card" ? "leading-tight" : "leading-normal",
        className,
      )}
      title={buildAriaLabel(lineage)}
    >
      {isUnlinked ? (
        <span style={{ color: "var(--color-muted)" }}>Unlinked</span>
      ) : (
        <>
          {value && (
            <span style={{ color: getValueColor(value), fontWeight: 500 }}>{value.name}</span>
          )}
          {goal && (
            <>
              {/* shrink-0, and NOT class "separator" — that HeroUI global is a full-width rule */}
              <span aria-hidden="true" className="shrink-0" style={{ color: "var(--color-muted)" }}>
                →
              </span>
              <span className="min-w-0 break-words" style={{ color: "var(--color-muted)" }}>
                {goal.name}
              </span>
            </>
          )}
          {fromHabit && (
            <span className="ml-1 inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-xs text-muted">
              Habit
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** Returns an inline style object for the value-colored left stripe (card owners apply this). */
export function getValueStripeStyle(lineage: TaskLineage): React.CSSProperties {
  const color = lineage.value ? getValueColor(lineage.value) : "var(--color-line)";
  return {
    borderInlineStart: `3px solid ${color}`,
  };
}

function buildAriaLabel(lineage: TaskLineage): string {
  const parts: string[] = [];
  if (lineage.value) parts.push(`Value: ${lineage.value.name}`);
  if (lineage.goal) parts.push(`Goal: ${lineage.goal.name}`);
  if (lineage.fromHabit) parts.push("from habit");
  if (!parts.length) return "Unlinked task";
  return parts.join(", ");
}
