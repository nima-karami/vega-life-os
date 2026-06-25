/**
 * <Lineage> — reusable display primitive for the Value → Goal → Habit chain.
 *
 * Renders:
 * - Value name in its valueColor
 * - Logical "→" separator + goal name (muted) when a goal exists (RTL-aware via CSS logical flow)
 * - "Habit" pill when lineage.fromHabit
 * - "Unlinked" in muted color when no value/goal/habit
 *
 * The value-colored left stripe is NOT rendered here — it's a layout concern for
 * the owning card (Today slice). Export `valueStripeStyle()` for card owners.
 */
import type { TaskLineage } from "@/features/tasks/lineage";
import { valueColor } from "@/features/values/color";
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
          {value && <span style={{ color: valueColor(value), fontWeight: 500 }}>{value.name}</span>}
          {goal && (
            <>
              {/* shrink-0 so the arrow never wraps away from / collapses under the goal.
              (No `separator` class — that collides with HeroUI's global .separator,
              which renders a full-width 1px rule.) */}
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
export function valueStripeStyle(lineage: TaskLineage): React.CSSProperties {
  const color = lineage.value ? valueColor(lineage.value) : "var(--color-line)";
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
